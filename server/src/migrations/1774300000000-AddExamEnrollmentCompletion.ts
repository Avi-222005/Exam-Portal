import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExamEnrollmentCompletion1774300000000 implements MigrationInterface {
  name = 'AddExamEnrollmentCompletion1774300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "exam_enrollments" ADD COLUMN IF NOT EXISTS "isCompleted" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "exam_enrollments" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "exam_enrollments" DROP COLUMN IF EXISTS "completedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "exam_enrollments" DROP COLUMN IF EXISTS "isCompleted"`,
    );
  }
}
