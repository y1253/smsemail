"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PendingSmsCommand = void 0;
const typeorm_1 = require("typeorm");
let PendingSmsCommand = class PendingSmsCommand {
    id;
    phone;
    body;
    emailIds;
    expiresAt;
    createdAt;
};
exports.PendingSmsCommand = PendingSmsCommand;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: 'id' }),
    __metadata("design:type", Number)
], PendingSmsCommand.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'phone', length: 45 }),
    __metadata("design:type", String)
], PendingSmsCommand.prototype, "phone", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'body', type: 'text' }),
    __metadata("design:type", String)
], PendingSmsCommand.prototype, "body", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'email_ids', length: 255 }),
    __metadata("design:type", String)
], PendingSmsCommand.prototype, "emailIds", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'expires_at', type: 'datetime' }),
    __metadata("design:type", Date)
], PendingSmsCommand.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'datetime' }),
    __metadata("design:type", Date)
], PendingSmsCommand.prototype, "createdAt", void 0);
exports.PendingSmsCommand = PendingSmsCommand = __decorate([
    (0, typeorm_1.Entity)('pending_sms_command')
], PendingSmsCommand);
//# sourceMappingURL=pending-sms-command.entity.js.map