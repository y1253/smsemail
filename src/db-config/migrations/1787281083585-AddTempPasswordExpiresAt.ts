import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds user.temp_password_expires_at, backing the forgot-password flow: it
 * stamps when an emailed temporary password stops being accepted at login.
 *
 * NULL means an ordinary, non-expiring password, so every existing row is
 * already correct — no backfill.
 *
 * Guarded on information_schema rather than a bare ALTER: the dev database had
 * the column applied by hand before this migration existed, and re-running
 * against it must not fail.
 */
export class AddTempPasswordExpiresAt1787281083585
  implements MigrationInterface
{
  name = 'AddTempPasswordExpiresAt1787281083585';

  private async hasColumn(queryRunner: QueryRunner): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'user'
          AND COLUMN_NAME = 'temp_password_expires_at'`,
    );
    return rows.length > 0;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await this.hasColumn(queryRunner)) return;
    await queryRunner.query(
      'ALTER TABLE `user` ADD COLUMN `temp_password_expires_at` DATETIME NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.hasColumn(queryRunner))) return;
    await queryRunner.query(
      'ALTER TABLE `user` DROP COLUMN `temp_password_expires_at`',
    );
  }
}
