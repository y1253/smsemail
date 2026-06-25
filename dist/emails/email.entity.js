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
exports.Email = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("../users/user.entity");
const income_message_entity_1 = require("../messages/income-message.entity");
const out_message_entity_1 = require("../messages/out-message.entity");
let Email = class Email {
    emailId;
    user;
    email;
    refreshToken;
    addedAt;
    deletedAt;
    lastHistoryId;
    watchExpiry;
    incomeMessages;
    outMessages;
};
exports.Email = Email;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: 'email_id' }),
    __metadata("design:type", Number)
], Email.prototype, "emailId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, (user) => user.emails),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", user_entity_1.User)
], Email.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'email', length: 145 }),
    __metadata("design:type", String)
], Email.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'refresh_token', length: 512 }),
    __metadata("design:type", String)
], Email.prototype, "refreshToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'added_at', type: 'datetime' }),
    __metadata("design:type", Date)
], Email.prototype, "addedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'deleted_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], Email.prototype, "deletedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_history_id', type: 'varchar', length: 30, nullable: true }),
    __metadata("design:type", Object)
], Email.prototype, "lastHistoryId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'watch_expiry', type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], Email.prototype, "watchExpiry", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => income_message_entity_1.IncomeMessage, (message) => message.email),
    __metadata("design:type", Array)
], Email.prototype, "incomeMessages", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => out_message_entity_1.OutMessage, (message) => message.email),
    __metadata("design:type", Array)
], Email.prototype, "outMessages", void 0);
exports.Email = Email = __decorate([
    (0, typeorm_1.Entity)('email')
], Email);
//# sourceMappingURL=email.entity.js.map