import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the delivery state that lets a failed SMS be retried instead of lost.
 *
 * Before this, income_message was inserted (claiming the Gmail id, which is
 * what stops a duplicate text) and only then was the SMS sent. A send failure
 * was logged and dropped, the history pointer still advanced, and the claim row
 * made every later push skip that mail — so the email could never become a
 * text. pending_set_ids records which sets still owe a message; the sweeper in
 * WebhooksService finishes the job.
 *
 * Existing rows get pending_set_ids NULL / send_attempts 0, i.e. "nothing
 * owed", which is correct: they were either delivered or already lost.
 */
export class AddSmsDeliveryState1789000000000 implements MigrationInterface {
  name = 'AddSmsDeliveryState1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`income_message\` ADD \`pending_set_ids\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`income_message\` ADD \`send_attempts\` int NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE \`income_message\` ADD \`last_attempt_at\` datetime NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`income_message\` DROP COLUMN \`last_attempt_at\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`income_message\` DROP COLUMN \`send_attempts\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`income_message\` DROP COLUMN \`pending_set_ids\``,
    );
  }
}
