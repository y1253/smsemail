import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds user.token_version, the counter that lets a password change or reset
 * invalidate sessions already issued to other devices (ASVS 3.3.3).
 *
 * Existing rows default to 0, which is also how a JWT minted before this
 * migration is treated, so no one is signed out by the deploy itself.
 */
export class AddTokenVersion1787900000000 implements MigrationInterface {
  name = 'AddTokenVersion1787900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`user\` ADD \`token_version\` int NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`user\` DROP COLUMN \`token_version\``);
  }
}
