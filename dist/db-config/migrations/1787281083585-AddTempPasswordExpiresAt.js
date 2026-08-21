"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddTempPasswordExpiresAt1787281083585 = void 0;
class AddTempPasswordExpiresAt1787281083585 {
    name = 'AddTempPasswordExpiresAt1787281083585';
    async hasColumn(queryRunner) {
        const rows = await queryRunner.query(`SELECT COLUMN_NAME FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'user'
          AND COLUMN_NAME = 'temp_password_expires_at'`);
        return rows.length > 0;
    }
    async up(queryRunner) {
        if (await this.hasColumn(queryRunner))
            return;
        await queryRunner.query('ALTER TABLE `user` ADD COLUMN `temp_password_expires_at` DATETIME NULL');
    }
    async down(queryRunner) {
        if (!(await this.hasColumn(queryRunner)))
            return;
        await queryRunner.query('ALTER TABLE `user` DROP COLUMN `temp_password_expires_at`');
    }
}
exports.AddTempPasswordExpiresAt1787281083585 = AddTempPasswordExpiresAt1787281083585;
//# sourceMappingURL=1787281083585-AddTempPasswordExpiresAt.js.map