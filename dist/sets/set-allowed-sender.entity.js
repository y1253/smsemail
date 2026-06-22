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
exports.SetAllowedSender = void 0;
const typeorm_1 = require("typeorm");
const email_phone_set_entity_1 = require("./email-phone-set.entity");
let SetAllowedSender = class SetAllowedSender {
    id;
    set;
    email;
};
exports.SetAllowedSender = SetAllowedSender;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: 'id' }),
    __metadata("design:type", Number)
], SetAllowedSender.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => email_phone_set_entity_1.EmailPhoneSet, (set) => set.allowedSenders, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'set_id' }),
    __metadata("design:type", email_phone_set_entity_1.EmailPhoneSet)
], SetAllowedSender.prototype, "set", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'email', type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], SetAllowedSender.prototype, "email", void 0);
exports.SetAllowedSender = SetAllowedSender = __decorate([
    (0, typeorm_1.Entity)('set_allowed_sender')
], SetAllowedSender);
//# sourceMappingURL=set-allowed-sender.entity.js.map