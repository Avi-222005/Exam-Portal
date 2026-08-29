import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddExamMaxViolations1774500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('exams');
    const hasColumn = table?.columns.some((c) => c.name === 'maxViolations');
    if (!hasColumn) {
      await queryRunner.addColumn(
        'exams',
        new TableColumn({
          name: 'maxViolations',
          type: 'int',
          default: 5,
          isNullable: false,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('exams');
    const hasColumn = table?.columns.some((c) => c.name === 'maxViolations');
    if (hasColumn) {
      await queryRunner.dropColumn('exams', 'maxViolations');
    }
  }
}
