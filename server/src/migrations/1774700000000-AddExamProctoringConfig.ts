import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddExamProctoringConfig1774700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('exams');
    const hasColumn = table?.columns.some((c) => c.name === 'proctoringConfig');
    if (!hasColumn) {
      await queryRunner.addColumn(
        'exams',
        new TableColumn({
          name: 'proctoringConfig',
          type: 'jsonb',
          default: `'{"isProctored":true,"enforceFullscreen":true,"preventTabSwitching":true,"detectSidePanel":true,"preventCopyPaste":true,"blockDevTools":true,"showWatermark":true,"maxViolations":5}'`,
          isNullable: false,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('exams');
    const hasColumn = table?.columns.some((c) => c.name === 'proctoringConfig');
    if (hasColumn) {
      await queryRunner.dropColumn('exams', 'proctoringConfig');
    }
  }
}
