"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddTokenVersion1787900000000 = void 0;
class AddTokenVersion1787900000000 {
    name = 'AddTokenVersion1787900000000';
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE \`user\` ADD \`token_version\` int NOT NULL DEFAULT 0`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE \`user\` DROP COLUMN \`token_version\``);
    }
}
exports.AddTokenVersion1787900000000 = AddTokenVersion1787900000000;
//# sourceMappingURL=1787900000000-AddTokenVersion.js.map