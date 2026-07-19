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
exports.User = void 0;
const typeorm_1 = require("typeorm");
const email_entity_1 = require("../emails/email.entity");
const phone_entity_1 = require("../phones/phone.entity");
const transaction_entity_1 = require("../transactions/transaction.entity");
const subscription_entity_1 = require("../subscriptions/subscription.entity");
let User = class User {
    userId;
    firstName;
    lastName;
    email;
    password;
    authType;
    createdAt;
    stripeCustomerId;
    active;
    emails;
    phones;
    transactions;
    subscriptions;
};
exports.User = User;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: 'user_id' }),
    __metadata("design:type", Number)
], User.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'first_name', type: 'varchar', length: 145, nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "firstName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_name', type: 'varchar', length: 145, nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "lastName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'email', type: 'varchar', length: 145, nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'password', type: 'varchar', length: 245, nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "password", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'auth_type', type: 'varchar', length: 45, nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "authType", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'create_at', type: 'datetime' }),
    __metadata("design:type", Date)
], User.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'stripe_customer_id', type: 'varchar', length: 245, nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "stripeCustomerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'active', type: 'tinyint', nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "active", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => email_entity_1.Email, (email) => email.user),
    __metadata("design:type", Array)
], User.prototype, "emails", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => phone_entity_1.Phone, (phone) => phone.user),
    __metadata("design:type", Array)
], User.prototype, "phones", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => transaction_entity_1.Transaction, (transaction) => transaction.user),
    __metadata("design:type", Array)
], User.prototype, "transactions", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => subscription_entity_1.Subscription, (subscription) => subscription.user),
    __metadata("design:type", Array)
], User.prototype, "subscriptions", void 0);
exports.User = User = __decorate([
    (0, typeorm_1.Entity)('user')
], User);
//# sourceMappingURL=user.entity.js.map