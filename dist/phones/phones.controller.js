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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhonesController = void 0;
const common_1 = require("@nestjs/common");
const phones_service_1 = require("./phones.service");
const auth_guard_1 = require("../auth/auth.guard");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const add_phone_dto_1 = require("./dto/add-phone.dto");
const verify_phone_dto_1 = require("./dto/verify-phone.dto");
const delete_phone_dto_1 = require("./dto/delete-phone.dto");
let PhonesController = class PhonesController {
    phonesService;
    constructor(phonesService) {
        this.phonesService = phonesService;
    }
    async listPhones(user) {
        return this.phonesService.listPhonesForUser(user.user_id);
    }
    async sendCode(dto, user) {
        return this.phonesService.sendVerificationCode(user.user_id, dto.phone, dto.consent);
    }
    async verify(dto, user) {
        return this.phonesService.verifyCode(user.user_id, dto.phone, dto.code);
    }
    async deletePhone(dto, user) {
        return this.phonesService.deletePhoneForUser(user.user_id, dto.phoneId);
    }
};
exports.PhonesController = PhonesController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PhonesController.prototype, "listPhones", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [add_phone_dto_1.AddPhoneDto, Object]),
    __metadata("design:returntype", Promise)
], PhonesController.prototype, "sendCode", null);
__decorate([
    (0, common_1.Post)('verify'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [verify_phone_dto_1.VerifyPhoneDto, Object]),
    __metadata("design:returntype", Promise)
], PhonesController.prototype, "verify", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [delete_phone_dto_1.DeletePhoneDto, Object]),
    __metadata("design:returntype", Promise)
], PhonesController.prototype, "deletePhone", null);
exports.PhonesController = PhonesController = __decorate([
    (0, common_1.Controller)('phones'),
    __metadata("design:paramtypes", [phones_service_1.PhonesService])
], PhonesController);
//# sourceMappingURL=phones.controller.js.map