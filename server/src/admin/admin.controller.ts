import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  ForbiddenException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { LeaderboardService } from './leaderboard.service';
import { Auth } from '../common/decorators/auth.decorator';
import { AuthType } from '../common/enums/auth-type.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { AdminGuard } from './guards/admin.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { User } from '../entities/user.entity';
import { AdminSetupDto } from './dto/admin-setup.dto';
import { AdminRegisterDto } from './dto/admin-register.dto';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { CreateProblemDto } from './dto/create-problem.dto';
import { UpdateProblemDto } from './dto/update-problem.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateScoreDto } from './dto/create-score.dto';
import { UpdateScoreDto } from './dto/update-score.dto';
import { CreateTestCaseStandaloneDto } from './dto/create-testcase.dto';
import { UpdateTestCaseStandaloneDto } from './dto/update-testcase.dto';
import { UsersService } from '../users/users.service';
import { SubmissionsService } from '../submissions/submissions.service';
import { ScoringService } from '../submissions/scoring.service';
import { AutosaveService } from '../autosave/autosave.service';
import { PaginationDto } from '../common/dto/pagination.dto';

import { BatchEnrollDto } from './dto/batch-enroll.dto';

@ApiExcludeController()
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly leaderboardService: LeaderboardService,
    private readonly usersService: UsersService,
    private readonly submissionsService: SubmissionsService,
    private readonly scoringService: ScoringService,
    private readonly autosaveService: AutosaveService,
  ) {}

  // --- Public: Admin Setup ---

  @Get('setup-status')
  @Auth(AuthType.NONE)
  async getSetupStatus() {
    return this.adminService.getSetupStatus();
  }

  @Post('setup')
  @Auth(AuthType.NONE)
  async adminSetup(@Body() dto: AdminSetupDto) {
    const user = await this.adminService.adminSetup(dto.email, dto.setupKey);
    return { message: 'User promoted to admin', userId: user.id };
  }

  @Post('register')
  @Auth(AuthType.NONE)
  async adminRegister(@Body() dto: AdminRegisterDto) {
    return this.adminService.adminRegister(dto);
  }

  // --- Protected: Admin Only ---

  @Get('stats')
  @Auth(AuthType.JWT, [AdminGuard])
  async getStats() {
    return this.adminService.getStats();
  }

  // --- Exams ---

  @Get('exams')
  @Auth(AuthType.JWT, [AdminGuard])
  async listExams(@Query() pagination: PaginationDto) {
    return this.adminService.listExams(pagination);
  }

  @Get('exams/:id')
  @Auth(AuthType.JWT, [AdminGuard])
  async getExam(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getExam(id);
  }

  @Get('exams/:id/problems')
  @Auth(AuthType.JWT, [AdminGuard])
  async listExamProblems(
    @Param('id', ParseIntPipe) id: number,
    @Query() pagination: PaginationDto,
  ) {
    return this.adminService.listExamProblems(id, pagination);
  }

  @Post('exams')
  @Auth(AuthType.JWT, [AdminGuard])
  async createExam(@Body() dto: CreateExamDto) {
    return this.adminService.createExam(dto);
  }

  @Put('exams/:id')
  @Auth(AuthType.JWT, [AdminGuard])
  async updateExam(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateExamDto,
  ) {
    return this.adminService.updateExam(id, dto);
  }

  @Delete('exams/:id')
  @Auth(AuthType.JWT, [AdminGuard])
  async deleteExam(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteExam(id);
  }

  @Post('exams/:id/duplicate')
  @Auth(AuthType.JWT, [AdminGuard])
  async duplicateExam(
    @Param('id', ParseIntPipe) id: number,
    @Body('title') title: string,
    @Body('startTime') startTime: string,
    @Body('endTime') endTime: string,
  ) {
    return this.adminService.duplicateExam(
      id,
      title,
      new Date(startTime),
      new Date(endTime),
    );
  }

  // --- Exam Candidate Enrollments ---

  @Get('exams/:id/enrollments')
  @Auth(AuthType.JWT, [AdminGuard])
  async getExamEnrollments(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getExamEnrollments(id);
  }

  @Post('exams/:id/enrollments/batch')
  @Auth(AuthType.JWT, [AdminGuard])
  async batchEnroll(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: BatchEnrollDto,
  ) {
    return this.adminService.batchEnroll(id, dto);
  }

  @Delete('exams/:id/enrollments/:userId')
  @Auth(AuthType.JWT, [AdminGuard])
  async removeEnrollment(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.adminService.removeEnrollment(id, userId);
  }

  // --- Problems ---

  @Get('problems/:id')
  @Auth(AuthType.JWT, [AdminGuard])
  async getProblem(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getProblem(id);
  }

  @Post('problems')
  @Auth(AuthType.JWT, [AdminGuard])
  async createProblem(@Body() dto: CreateProblemDto) {
    return this.adminService.createProblem(dto);
  }

  @Post('problems/bulk')
  @Auth(AuthType.JWT, [AdminGuard])
  async createProblemsBulk(
    @Body() body: { examId?: number; problems: CreateProblemDto[] },
  ) {
    return this.adminService.createProblemsBulk(body.examId, body.problems);
  }

  @Put('problems/:id')
  @Auth(AuthType.JWT, [AdminGuard])
  async updateProblem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProblemDto,
  ) {
    return this.adminService.updateProblem(id, dto);
  }

  @Delete('problems/:id')
  @Auth(AuthType.JWT, [AdminGuard])
  async deleteProblem(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteProblem(id);
  }

  @Post('problems/bulk-delete')
  @Auth(AuthType.JWT, [AdminGuard])
  async deleteProblemsBulk(@Body('problemIds') problemIds: number[]) {
    return this.adminService.deleteProblemsBulk(problemIds);
  }

  @Post('exams/:id/problems/batch-assign')
  @Auth(AuthType.JWT, [AdminGuard])
  async batchAssignProblemsToExam(
    @Param('id', ParseIntPipe) examId: number,
    @Body('problemIds') problemIds: number[],
  ) {
    return this.adminService.batchAssignProblemsToExam(examId, problemIds);
  }

  @Put('exams/:id/problems/reorder')
  @Auth(AuthType.JWT, [AdminGuard])
  async reorderExamProblems(
    @Param('id', ParseIntPipe) examId: number,
    @Body('orders') orders: { problemId: number; displayOrder: number }[],
  ) {
    return this.adminService.reorderExamProblems(examId, orders);
  }

  @Patch('problems/:id/assign-exam')
  @Auth(AuthType.JWT, [AdminGuard])
  async assignProblemToExam(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { examId: number; displayOrder: number },
  ) {
    return this.adminService.assignProblemToExam(
      id,
      body.examId,
      body.displayOrder,
    );
  }

  @Delete('problems/:id/assign-exam/:examId')
  @Auth(AuthType.JWT, [AdminGuard])
  async unassignProblemFromExam(
    @Param('id', ParseIntPipe) id: number,
    @Param('examId', ParseIntPipe) examId: number,
  ) {
    return this.adminService.unassignProblemFromExam(id, examId);
  }

  // --- Leaderboard ---

  @Get('leaderboard/:examId')
  @Auth(AuthType.JWT, [AdminGuard])
  async getLeaderboard(
    @Param('examId', ParseIntPipe) examId: number,
    @Query('qaRoleOptIn') qaRoleOptIn?: string,
  ) {
    return this.leaderboardService.getLeaderboard(examId, {
      qaRoleOptIn: qaRoleOptIn === 'true',
    });
  }

  @Post('leaderboard/:examId/refresh')
  @Auth(AuthType.JWT, [AdminGuard])
  async refreshLeaderboard() {
    await this.leaderboardService.refreshView();
    return { message: 'Leaderboard refreshed' };
  }

  @Get('leaderboard/:examId/live')
  @Auth(AuthType.JWT, [AdminGuard])
  async getLeaderboardLive(
    @Param('examId', ParseIntPipe) examId: number,
    @Query('qaRoleOptIn') qaRoleOptIn?: string,
  ) {
    return this.leaderboardService.getLeaderboardLive(examId, {
      qaRoleOptIn: qaRoleOptIn === 'true',
    });
  }

  // --- All Problems (cross-exam) ---

  @Get('all-problems')
  @Auth(AuthType.JWT, [AdminGuard])
  async listAllProblems(
    @Query() pagination: PaginationDto,
    @Query('examId') examId?: string,
  ) {
    return this.adminService.listAllProblems(
      examId ? +examId : undefined,
      pagination,
    );
  }

  // --- All Test Cases (cross-problem) ---

  @Get('all-testcases')
  @Auth(AuthType.JWT, [AdminGuard])
  async listAllTestCases(
    @Query() pagination: PaginationDto,
    @Query('problemId') problemId?: string,
  ) {
    return this.adminService.listAllTestCases(
      problemId ? +problemId : undefined,
      pagination,
    );
  }

  @Get('testcases/:id')
  @Auth(AuthType.JWT, [AdminGuard])
  async getTestCase(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getTestCase(id);
  }

  @Post('testcases')
  @Auth(AuthType.JWT, [AdminGuard])
  async createTestCase(@Body() dto: CreateTestCaseStandaloneDto) {
    return this.adminService.createTestCase(dto);
  }

  @Put('testcases/:id')
  @Auth(AuthType.JWT, [AdminGuard])
  async updateTestCase(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTestCaseStandaloneDto,
  ) {
    return this.adminService.updateTestCase(id, dto);
  }

  @Delete('testcases/:id')
  @Auth(AuthType.JWT, [AdminGuard])
  async deleteTestCase(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteTestCase(id);
  }

  // --- Users ---

  @Get('users')
  @Auth(AuthType.JWT, [AdminGuard])
  async listUsers(
    @GetUser() adminUser: User,
    @Query() pagination: PaginationDto,
    @Query('qaRoleOptIn') qaRoleOptIn?: string,
    @Query('role') role?: UserRole,
  ) {
    return this.usersService.findAll(pagination, {
      qaRoleOptIn: qaRoleOptIn === 'true',
      requestingUser: adminUser,
      role,
    });
  }

  @Get('users/:id')
  @Auth(AuthType.JWT, [AdminGuard])
  async getUser(
    @GetUser() adminUser: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const user = await this.usersService.findByIdOrFail(id);
    if (
      user.role === UserRole.SUPER_ADMIN &&
      adminUser.role !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        'Access denied: You do not have permission to view Super Administrator accounts.',
      );
    }
    const result = { ...user } as Record<string, unknown>;
    delete result.password;
    return result;
  }

  @Post('users')
  @Auth(AuthType.JWT, [AdminGuard])
  async createUser(
    @GetUser() adminUser: User,
    @Body() dto: CreateUserDto,
  ) {
    return this.usersService.adminCreate(dto, adminUser.id);
  }

  @Put('users/:id')
  @Auth(AuthType.JWT, [AdminGuard])
  async updateUser(
    @GetUser() adminUser: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(id, dto, adminUser);
  }

  @Delete('users/:id')
  @Auth(AuthType.JWT, [AdminGuard])
  async deleteUser(
    @GetUser() adminUser: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.usersService.delete(id, adminUser);
  }

  // --- Submissions ---

  @Get('submissions')
  @Auth(AuthType.JWT, [AdminGuard])
  async listSubmissions(
    @Query() pagination: PaginationDto,
    @Query('examId') examId?: string,
  ) {
    return this.submissionsService.findAllAdmin(
      examId ? +examId : undefined,
      pagination,
    );
  }

  @Get('submissions/:id')
  @Auth(AuthType.JWT, [AdminGuard])
  async getSubmission(@Param('id', ParseIntPipe) id: number) {
    return this.submissionsService.getByIdAdmin(id);
  }

  @Delete('submissions/:id')
  @Auth(AuthType.JWT, [AdminGuard])
  async deleteSubmission(@Param('id', ParseIntPipe) id: number) {
    return this.submissionsService.deleteById(id);
  }

  // --- Scores ---

  @Get('scores/aggregated')
  @Auth(AuthType.JWT, [AdminGuard])
  async listAggregatedScores(
    @Query() pagination: PaginationDto,
    @Query('examId') examId?: string,
    @Query('qaRoleOptIn') qaRoleOptIn?: string,
  ) {
    return this.scoringService.findAggregated(
      examId ? +examId : undefined,
      pagination,
      { qaRoleOptIn: qaRoleOptIn === 'true' },
    );
  }

  @Get('scores/by-user-exam')
  @Auth(AuthType.JWT, [AdminGuard])
  async getScoresByUserExam(
    @Query('userId', ParseIntPipe) userId: number,
    @Query('examId', ParseIntPipe) examId: number,
  ) {
    return this.scoringService.findByUserExam(userId, examId);
  }

  @Get('scores')
  @Auth(AuthType.JWT, [AdminGuard])
  async listScores(
    @Query() pagination: PaginationDto,
    @Query('examId') examId?: string,
  ) {
    return this.scoringService.findAll(
      examId ? +examId : undefined,
      pagination,
    );
  }

  @Get('scores/:id')
  @Auth(AuthType.JWT, [AdminGuard])
  async getScore(@Param('id', ParseIntPipe) id: number) {
    return this.scoringService.findOne(id);
  }

  @Post('scores')
  @Auth(AuthType.JWT, [AdminGuard])
  async createScore(@Body() dto: CreateScoreDto) {
    return this.scoringService.create(dto);
  }

  @Put('scores/:id')
  @Auth(AuthType.JWT, [AdminGuard])
  async updateScore(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateScoreDto,
  ) {
    return this.scoringService.update(id, dto);
  }

  @Delete('scores/:id')
  @Auth(AuthType.JWT, [AdminGuard])
  async deleteScore(@Param('id', ParseIntPipe) id: number) {
    return this.scoringService.delete(id);
  }

  // --- Run Logs ---

  @Get('run-logs')
  @Auth(AuthType.JWT, [AdminGuard])
  async getRunLogs(
    @Query() pagination: PaginationDto,
    @Query('examId') examId?: string,
    @Query('problemId') problemId?: string,
    @Query('userId') userId?: string,
  ) {
    return this.adminService.getRunLogs(
      {
        examId: examId ? +examId : undefined,
        problemId: problemId ? +problemId : undefined,
        userId: userId ? +userId : undefined,
      },
      pagination,
    );
  }

  // --- Problem Views ---

  @Get('problem-views')
  @Auth(AuthType.JWT, [AdminGuard])
  async getProblemViews(
    @Query() pagination: PaginationDto,
    @Query('examId') examId?: string,
    @Query('problemId') problemId?: string,
  ) {
    return this.adminService.getProblemViews(
      {
        examId: examId ? +examId : undefined,
        problemId: problemId ? +problemId : undefined,
      },
      pagination,
    );
  }

  // --- Problem Analytics ---

  @Get('problem-analytics')
  @Auth(AuthType.JWT, [AdminGuard])
  async getProblemAnalytics(@Query('examId', ParseIntPipe) examId: number) {
    return this.adminService.getProblemAnalytics(examId);
  }

  // --- User Exam Detail ---

  @Get('user-exam-detail')
  @Auth(AuthType.JWT, [AdminGuard])
  async getUserExamDetail(
    @Query('userId', ParseIntPipe) userId: number,
    @Query('examId', ParseIntPipe) examId: number,
  ) {
    return this.adminService.getUserExamDetail(userId, examId);
  }

  // --- AutoSave ---

  @Get('autosaves')
  @Auth(AuthType.JWT, [AdminGuard])
  async listAutoSaves(
    @Query() pagination: PaginationDto,
    @Query('examId') examId?: string,
  ) {
    return this.autosaveService.findAll(
      examId ? +examId : undefined,
      pagination,
    );
  }

  @Get('autosaves/:id')
  @Auth(AuthType.JWT, [AdminGuard])
  async getAutoSave(@Param('id', ParseIntPipe) id: number) {
    return this.autosaveService.findOne(id);
  }

  @Delete('autosaves/:id')
  @Auth(AuthType.JWT, [AdminGuard])
  async deleteAutoSave(@Param('id', ParseIntPipe) id: number) {
    return this.autosaveService.deleteById(id);
  }
}
