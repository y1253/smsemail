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
exports.EmailPhoneSet = void 0;
const typeorm_1 = require("typeorm");
const email_entity_1 = require("../emails/email.entity");
const phone_entity_1 = require("../phones/phone.entity");
const set_allowed_sender_entity_1 = require("./set-allowed-sender.entity");
let EmailPhoneSet = class EmailPhoneSet {
    setId;
    email;
    phone;
    createdAt;
    deletedAt;
    stripeSubscriptionId;
    allowedSenders;
};
exports.EmailPhoneSet = EmailPhoneSet;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: 'set_id' }),
    __metadata("design:type", Number)
], EmailPhoneSet.prototype, "setId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => email_entity_1.Email),
    (0, typeorm_1.JoinColumn)({ name: 'email_id' }),
    __metadata("design:type", email_entity_1.Email)
], EmailPhoneSet.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => phone_entity_1.Phone),
    (0, typeorm_1.JoinColumn)({ name: 'phone_id' }),
    __metadata("design:type", phone_entity_1.Phone)
], EmailPhoneSet.prototype, "phone", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_at', type: 'datetime' }),
    __metadata("design:type", Date)
], EmailPhoneSet.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'deleted_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], EmailPhoneSet.prototype, "deletedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'stripe_subscription_id', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", Object)
], EmailPhoneSet.prototype, "stripeSubscriptionId", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => set_allowed_sender_entity_1.SetAllowedSender, (s) => s.set, { eager: false }),
    __metadata("design:type", Array)
], EmailPhoneSet.prototype, "allowedSenders", void 0);
exports.EmailPhoneSet = EmailPhoneSet = __decorate([
    (0, typeorm_1.Entity)('email_phone_set')
], EmailPhoneSet);
//# sourceMappingURL=email-phone-set.entity.js.map