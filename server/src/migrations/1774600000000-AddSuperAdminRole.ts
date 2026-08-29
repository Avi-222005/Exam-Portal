import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSuperAdminRole1774600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add SUPER_ADMIN to users_role_enum
    await queryRunner.query(`
      ALTER TYPE "public"."users_role_enum" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
    `);

    // PostgreSQL requires committing the transaction before the new enum value can be referenced
    await queryRunner.commitTransaction();
    await queryRunner.startTransaction();

    // 2. Promote the primary/earliest admin account to SUPER_ADMIN
    await queryRunner.query(`
      UPDATE users
      SET role = 'SUPER_ADMIN'
      WHERE id = (
        SELECT id FROM users WHERE role = 'ADMIN' ORDER BY id ASC LIMIT 1
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert SUPER_ADMIN users back to ADMIN
    await queryRunner.query(`
      UPDATE users
      SET role = 'ADMIN'
      WHERE role = 'SUPER_ADMIN';
    `);
  }
}
