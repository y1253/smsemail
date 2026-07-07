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
exports.Phone = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("../users/user.entity");
let Phone = class Phone {
    phoneId;
    user;
    phone;
    addedAt;
    deletedAt;
    consentAt;
    optedOutAt;
};
exports.Phone = Phone;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: 'phone_id' }),
    __metadata("design:type", Number)
], Phone.prototype, "phoneId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, (user) => user.phones),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", user_entity_1.User)
], Phone.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'phone', length: 45 }),
    __metadata("design:type", String)
], Phone.prototype, "phone", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'added_at', type: 'datetime' }),
    __metadata("design:type", Date)
], Phone.prototype, "addedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'deleted_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], Phone.prototype, "deletedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'consent_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], Phone.prototype, "consentAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'opted_out_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], Phone.prototype, "optedOutAt", void 0);
exports.Phone = Phone = __decorate([
    (0, typeorm_1.Entity)('phone')
], Phone);
//# sourceMappingURL=phone.entity.js.map