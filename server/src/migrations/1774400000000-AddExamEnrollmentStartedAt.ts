import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExamEnrollmentStartedAt1774400000000 implements MigrationInterface {
  name = 'AddExamEnrollmentStartedAt1774400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "exam_enrollments" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "exam_enrollments" DROP COLUMN IF EXISTS "startedAt"`,
    );
  }
}
