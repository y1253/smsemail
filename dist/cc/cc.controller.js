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
exports.CcController = void 0;
const common_1 = require("@nestjs/common");
const cc_service_1 = require("./cc.service");
const auth_guard_1 = require("../auth/auth.guard");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const attach_payment_method_dto_1 = require("./dto/attach-payment-method.dto");
const delete_cc_dto_1 = require("./dto/delete-cc.dto");
let CcController = class CcController {
    ccService;
    constructor(ccService) {
        this.ccService = ccService;
    }
    async attachPaymentMethod(dto, user) {
        return this.ccService.attachPaymentMethodForUser(user.user_id, dto.paymentMethodId);
    }
    async listPaymentMethods(user) {
        return this.ccService.listPaymentMethodsForUser(user.user_id);
    }
    async deletePaymentMethod(dto, user) {
        return this.ccService.deletePaymentMethodForUser(user.user_id, dto.cc_id);
    }
};
exports.CcController = CcController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [attach_payment_method_dto_1.AttachPaymentMethodDto, Object]),
    __metadata("design:returntype", Promise)
], CcController.prototype, "attachPaymentMethod", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CcController.prototype, "listPaymentMethods", null);
__decorate([
    (0, common_1.Delete)(),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [delete_cc_dto_1.DeleteCcDto, Object]),
    __metadata("design:returntype", Promise)
], CcController.prototype, "deletePaymentMethod", null);
exports.CcController = CcController = __decorate([
    (0, common_1.Controller)('cc'),
    __metadata("design:paramtypes", [cc_service_1.CcService])
], CcController);
//# sourceMappingURL=cc.controller.js.map