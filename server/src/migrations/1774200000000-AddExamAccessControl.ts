import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExamAccessControl1774200000000 implements MigrationInterface {
  name = 'AddExamAccessControl1774200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "exams" ADD "accessType" character varying(32) NOT NULL DEFAULT 'open'`,
    );
    await queryRunner.query(
      `ALTER TABLE "exams" ADD "passcode" character varying(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "exams" DROP COLUMN "passcode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "exams" DROP COLUMN "accessType"`,
    );
  }
}
