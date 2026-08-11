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
exports.IncomeMessage = void 0;
const typeorm_1 = require("typeorm");
const email_entity_1 = require("../emails/email.entity");
let IncomeMessage = class IncomeMessage {
    messageId;
    email;
    createdAt;
    gmailMessageId;
    gmailThreadId;
    sender;
    subject;
    rfcMessageId;
    referencesHeader;
};
exports.IncomeMessage = IncomeMessage;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: 'message_id' }),
    __metadata("design:type", Number)
], IncomeMessage.prototype, "messageId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => email_entity_1.Email, (email) => email.incomeMessages),
    (0, typeorm_1.JoinColumn)({ name: 'email_id' }),
    __metadata("design:type", email_entity_1.Email)
], IncomeMessage.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: 'create_at', type: 'datetime' }),
    __metadata("design:type", Date)
], IncomeMessage.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'gmail_message_id', length: 145 }),
    __metadata("design:type", String)
], IncomeMessage.prototype, "gmailMessageId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'gmail_thread_id', length: 145 }),
    __metadata("design:type", String)
], IncomeMessage.prototype, "gmailThreadId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'sender', length: 145 }),
    __metadata("design:type", String)
], IncomeMessage.prototype, "sender", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'subject', length: 255 }),
    __metadata("design:type", String)
], IncomeMessage.prototype, "subject", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'rfc_message_id', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], IncomeMessage.prototype, "rfcMessageId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'references_header', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], IncomeMessage.prototype, "referencesHeader", void 0);
exports.IncomeMessage = IncomeMessage = __decorate([
    (0, typeorm_1.Index)('uq_income_message_gmail', ['email', 'gmailMessageId'], { unique: true }),
    (0, typeorm_1.Entity)('income_message')
], IncomeMessage);
//# sourceMappingURL=income-message.entity.js.map