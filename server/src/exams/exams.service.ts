import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Not, IsNull, MoreThan, QueryFailedError } from 'typeorm';
import { Exam } from '../entities/exam.entity';
import { Problem } from '../entities/problem.entity';
import { ProblemToExam } from '../entities/problem-to-exam.entity';
import { Score } from '../entities/score.entity';
import { Submission } from '../entities/submission.entity';
import { ExamEnrollment } from '../entities/exam-enrollment.entity';
import { LeaderboardView } from '../entities/leaderboard-view.entity';

@Injectable()
export class ExamsService {
  constructor(
    @InjectRepository(Exam)
    private readonly examRepo: Repository<Exam>,
    @InjectRepository(Problem)
    private readonly problemRepo: Repository<Problem>,
    @InjectRepository(ProblemToExam)
    private readonly problemToExamRepo: Repository<ProblemToExam>,
    @InjectRepository(Score)
    private readonly scoreRepo: Repository<Score>,
    @InjectRepository(Submission)
    private readonly submissionRepo: Repository<Submission>,
    @InjectRepository(ExamEnrollment)
    private readonly enrollmentRepo: Repository<ExamEnrollment>,
    @InjectRepository(LeaderboardView)
    private readonly leaderboardRepo: Repository<LeaderboardView>,
    private readonly dataSource: DataSource,
  ) {}

  // Returns all active exams that have not yet ended (upcoming or in-progress).
  async getUpcomingExams(): Promise<Exam[]> {
    return this.examRepo.find({
      where: { isActive: true, endTime: MoreThan(new Date()) },
      order: { startTime: 'ASC' },
    });
  }

  async getById(id: number): Promise<Exam> {
    const exam = await this.examRepo.findOne({ where: { id } });
    if (!exam) throw new NotFoundException('Exam not found');
    return exam;
  }

  async getStatus(examId: number) {
    const exam = await this.getById(examId);
    return {
      examId: exam.id,
      examEndTime: exam.endTime,
      serverTime: new Date(),
    };
  }

  async getMyProgress(userId: number, examId: number) {
    const exam = await this.getById(examId);

    const mappings = await this.problemToExamRepo.find({
      where: { examId: exam.id },
      relations: ['problem'],
    });

    const codingProblemIds = mappings
      .filter((m) => m.problem.questionType === 'coding')
      .map((m) => m.problemId);
    const mcqProblemIds = mappings
      .filter((m) => m.problem.questionType === 'mcq')
      .map((m) => m.problemId);
    const hasMcq = mcqProblemIds.length > 0;

    const [solvedScores, mcqSectionSubmitted] = await Promise.all([
      this.scoreRepo.find({
        where: { userId, examId: exam.id, firstSolvedAt: Not(IsNull()) },
        select: ['problemId'],
      }),
      hasMcq
        ? this.submissionRepo
            .createQueryBuilder('s')
            .where('s.userId = :userId', { userId })
            .andWhere('s.examId = :examId', { examId: exam.id })
            .andWhere('s.problemId IN (:...problemIds)', {
              problemIds: mcqProblemIds,
            })
            .getCount()
            .then((count) => count > 0)
        : Promise.resolve(false),
    ]);

    const solvedCodingIds = solvedScores
      .filter((s) => codingProblemIds.includes(s.problemId))
      .map((s) => s.problemId);

    // MCQ section counts as 1 unit; each coding problem is 1 unit
    const totalUnits = codingProblemIds.length + (hasMcq ? 1 : 0);
    const solvedUnits = solvedCodingIds.length + (mcqSectionSubmitted ? 1 : 0);

    const enrollment = await this.enrollmentRepo.findOne({
      where: { userId, examId: exam.id },
    });

    return {
      examId: exam.id,
      totalProblems: totalUnits,
      solvedProblems: solvedUnits,
      allSolved: totalUnits > 0 && solvedUnits === totalUnits,
      solvedProblemIds: solvedCodingIds,
      mcqSectionSubmitted,
      mcqProblemCount: mcqProblemIds.length,
      isStarted: !!enrollment?.startedAt,
      startedAt: enrollment?.startedAt ?? null,
      isCompleted: enrollment?.isCompleted ?? false,
      completedAt: enrollment?.completedAt ?? null,
    };
  }

  async startExam(
    userId: number,
    examId: number,
  ): Promise<{ success: boolean; startedAt: Date }> {
    const exam = await this.getById(examId);

    let enrollment = await this.enrollmentRepo.findOne({
      where: { userId, examId: exam.id },
    });

    const now = new Date();
    if (!enrollment) {
      enrollment = this.enrollmentRepo.create({
        userId,
        examId: exam.id,
        startedAt: now,
      });
    } else if (!enrollment.startedAt) {
      enrollment.startedAt = now;
    }

    await this.enrollmentRepo.save(enrollment);
    return { success: true, startedAt: enrollment.startedAt ?? now };
  }

  async finishExam(
    userId: number,
    examId: number,
  ): Promise<{ success: boolean; completedAt: Date }> {
    const exam = await this.getById(examId);

    let enrollment = await this.enrollmentRepo.findOne({
      where: { userId, examId: exam.id },
    });

    const completedAt = new Date();
    if (!enrollment) {
      enrollment = this.enrollmentRepo.create({
        userId,
        examId: exam.id,
        isCompleted: true,
        completedAt,
      });
    } else {
      enrollment.isCompleted = true;
      enrollment.completedAt = completedAt;
    }

    await this.enrollmentRepo.save(enrollment);
    return { success: true, completedAt };
  }

  async isExamCompleted(userId: number, examId: number): Promise<boolean> {
    const enrollment = await this.enrollmentRepo.findOne({
      where: { userId, examId },
    });
    return !!enrollment?.isCompleted;
  }

  async logProctorEvent(
    userId: number,
    examId: number,
    eventData: { eventType: string; violationCount: number; timestamp?: string },
  ): Promise<{ logged: boolean }> {
    return { logged: true };
  }

  async enroll(
    userId: number,
    examId: number,
    passcode?: string,
  ): Promise<ExamEnrollment> {
    const exam = await this.examRepo.findOne({ where: { id: examId } });
    if (!exam) throw new NotFoundException('Exam not found');

    if (!exam.isActive) {
      throw new ForbiddenException('Exam is not open for enrollment');
    }

    if (exam.endTime < new Date()) {
      throw new BadRequestException('Exam has already ended');
    }

    // Access control checks
    if (exam.accessType === 'passcode') {
      const trimmedGiven = passcode?.trim().toUpperCase();
      const trimmedActual = exam.passcode?.trim().toUpperCase();
      if (!trimmedGiven || trimmedGiven !== trimmedActual) {
        throw new BadRequestException(
          'Incorrect exam passcode. Please verify the access code with your test administrator.',
        );
      }
    } else if (exam.accessType === 'whitelist') {
      const isWhitelisted = await this.isEnrolled(userId, examId);
      if (!isWhitelisted) {
        throw new ForbiddenException(
          'This exam is restricted to pre-approved candidates. Please contact your test administrator to be assigned.',
        );
      }
      const existing = await this.enrollmentRepo.findOne({
        where: { userId, examId },
      });
      if (existing) return existing;
    }

    const enrollment = this.enrollmentRepo.create({ userId, examId });
    try {
      return await this.enrollmentRepo.save(enrollment);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as QueryFailedError & { code?: string }).code === '23505'
      ) {
        throw new ConflictException('Already enrolled in this exam');
      }
      throw err;
    }
  }

  async isEnrolled(userId: number, examId: number): Promise<boolean> {
    const result = await this.enrollmentRepo.findOne({
      where: { userId, examId },
    });
    return !!result;
  }

  async getMyEnrollments(userId: number): Promise<ExamEnrollment[]> {
    return this.enrollmentRepo.find({
      where: { userId },
      relations: ['exam'],
    });
  }

  async getAllExamsWithDetails() {
    const exams = await this.examRepo.find({
      where: { isActive: true },
      order: { startTime: 'DESC' },
    });

    const allMappings = await this.problemToExamRepo.find({
      relations: ['problem'],
    });

    return exams.map((exam) => {
      const examMappings = allMappings.filter((m) => m.examId === exam.id);
      const mcqCount = examMappings.filter(
        (m) => m.problem.questionType === 'mcq',
      ).length;
      const codingCount = examMappings.filter(
        (m) => m.problem.questionType === 'coding',
      ).length;
      const totalMarks = examMappings.reduce(
        (sum, m) => sum + (Number(m.problem.maxScore) || 0),
        0,
      );

      return {
        id: exam.id,
        title: exam.title,
        startTime: exam.startTime,
        endTime: exam.endTime,
        durationMinutes: exam.durationMinutes,
        allowedLanguages: exam.allowedLanguages,
        accessType: exam.accessType || 'open',
        isPasscodeProtected: exam.accessType === 'passcode',
        maxViolations: exam.maxViolations ?? 5,
        mcqCount,
        codingCount,
        totalProblems: examMappings.length,
        totalMarks,
      };
    });
  }

  async getMySubmissions(userId: number) {
    return this.submissionRepo.find({
      where: { userId },
      relations: ['problem', 'exam'],
      order: { submittedAt: 'DESC' },
      take: 100,
    });
  }

  async getExamLeaderboard(examId: number) {
    const exam = await this.examRepo.findOne({
      where: { id: examId },
    });

    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    const problemMappings = await this.problemToExamRepo.find({
      where: { examId },
      relations: ['problem'],
      order: { displayOrder: 'ASC' },
    });

    const problems = problemMappings.map((pm) => ({
      id: pm.problem.id,
      title: pm.problem.title,
      questionType: pm.problem.questionType,
      maxScore: Number(pm.problem.maxScore) || 0,
      displayOrder: pm.displayOrder,
    }));

    // Fetch leaderboard entries
    let entries: any[] = [];
    if (exam.isActive) {
      entries = await this.leaderboardRepo.find({
        where: { examId },
        order: {
          totalScore: 'DESC',
          solvedCount: 'DESC',
          totalPenaltyTime: 'ASC',
          lastSolvedAt: 'ASC',
        },
      });
    }

    // Fallback to live query if entries is empty or exam is past/inactive
    if (!entries || entries.length === 0) {
      entries = await this.dataSource.query(
        `
        SELECT
          s."examId",
          s."userId",
          u."rollNumber",
          u."firstName",
          u."lastName",
          COUNT(CASE WHEN s."firstSolvedAt" IS NOT NULL AND p."questionType" = 'coding' THEN 1 END)::int AS "solvedCount",
          COALESCE(SUM(s."bestScore"), 0)::decimal(10,2) AS "totalScore",
          COALESCE(
            SUM(
              CASE WHEN s."firstSolvedAt" IS NOT NULL AND p."questionType" = 'coding' THEN
                EXTRACT(EPOCH FROM (s."firstSolvedAt" - e."startTime")) / 60.0
                + s."wrongAttempts" * 5
              ELSE 0 END
            ), 0
          )::numeric AS "totalPenaltyTime",
          MAX(s."firstSolvedAt") AS "lastSolvedAt",
          jsonb_object_agg(
            s."problemId"::text,
            jsonb_build_object(
              'score', s."bestScore",
              'solved', s."firstSolvedAt" IS NOT NULL,
              'attempts', s."totalAttempts"
            )
          ) AS "problemScores"
        FROM scores s
        JOIN users u ON u.id = s."userId"
        JOIN exams e ON e.id = s."examId"
        JOIN problems p ON p.id = s."problemId"
        WHERE s."examId" = $1
        GROUP BY s."examId", s."userId", u."rollNumber", u."firstName", u."lastName"
        ORDER BY "totalScore" DESC, "solvedCount" DESC, "totalPenaltyTime" ASC, "lastSolvedAt" ASC NULLS LAST, u."rollNumber" ASC
        `,
        [examId],
      );
    }

    // Map numbers cleanly
    const sanitizedEntries = entries.map((entry) => ({
      examId: Number(entry.examId),
      userId: Number(entry.userId),
      rollNumber: String(entry.rollNumber || ''),
      firstName: String(entry.firstName || ''),
      lastName: String(entry.lastName || ''),
      solvedCount: Number(entry.solvedCount) || 0,
      totalScore: Number(entry.totalScore) || 0,
      totalPenaltyTime: Number(entry.totalPenaltyTime) || 0,
      lastSolvedAt: entry.lastSolvedAt ? new Date(entry.lastSolvedAt) : null,
      problemScores: entry.problemScores || {},
    }));

    return {
      exam: {
        id: exam.id,
        title: exam.title,
        isActive: exam.isActive,
        startTime: exam.startTime,
        endTime: exam.endTime,
        durationMinutes: exam.durationMinutes,
      },
      problems,
      leaderboard: sanitizedEntries,
    };
  }
}
