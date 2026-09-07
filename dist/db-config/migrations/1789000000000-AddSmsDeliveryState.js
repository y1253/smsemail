"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddSmsDeliveryState1789000000000 = void 0;
class AddSmsDeliveryState1789000000000 {
    name = 'AddSmsDeliveryState1789000000000';
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE \`income_message\` ADD \`pending_set_ids\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`income_message\` ADD \`send_attempts\` int NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE \`income_message\` ADD \`last_attempt_at\` datetime NULL`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE \`income_message\` DROP COLUMN \`last_attempt_at\``);
        await queryRunner.query(`ALTER TABLE \`income_message\` DROP COLUMN \`send_attempts\``);
        await queryRunner.query(`ALTER TABLE \`income_message\` DROP COLUMN \`pending_set_ids\``);
    }
}
exports.AddSmsDeliveryState1789000000000 = AddSmsDeliveryState1789000000000;
//# sourceMappingURL=1789000000000-AddSmsDeliveryState.js.map