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
exports.DeletedPhone = void 0;
const typeorm_1 = require("typeorm");
let DeletedPhone = class DeletedPhone {
    id;
    userId;
    originalPhoneId;
    phone;
    createdAt;
    deletedAt;
};
exports.DeletedPhone = DeletedPhone;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: 'deleted_phone_id' }),
    __metadata("design:type", Number)
], DeletedPhone.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", Number)
], DeletedPhone.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'phone_id' }),
    __metadata("design:type", Number)
], DeletedPhone.prototype, "originalPhoneId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'phone', length: 45 }),
    __metadata("design:type", String)
], DeletedPhone.prototype, "phone", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_at', type: 'datetime' }),
    __metadata("design:type", Date)
], DeletedPhone.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'deleted_at', type: 'datetime' }),
    __metadata("design:type", Date)
], DeletedPhone.prototype, "deletedAt", void 0);
exports.DeletedPhone = DeletedPhone = __decorate([
    (0, typeorm_1.Entity)('deleted_phone')
], DeletedPhone);
//# sourceMappingURL=deleted-phone.entity.js.map