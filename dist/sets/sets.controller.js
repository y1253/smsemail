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
exports.SetsController = void 0;
const common_1 = require("@nestjs/common");
const sets_service_1 = require("./sets.service");
const auth_guard_1 = require("../auth/auth.guard");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const create_set_dto_1 = require("./dto/create-set.dto");
const update_senders_dto_1 = require("./dto/update-senders.dto");
let SetsController = class SetsController {
    setsService;
    constructor(setsService) {
        this.setsService = setsService;
    }
    async listSets(user) {
        return this.setsService.listSetsForUser(user.user_id);
    }
    async createSet(dto, user) {
        return this.setsService.createSetForUser(user.user_id, dto.emailId, dto.phoneId, dto.promoCode);
    }
    async deleteSet(setId, user) {
        return this.setsService.deleteSetForUser(user.user_id, setId);
    }
    async updateSenders(setId, dto, user) {
        return this.setsService.updateSenders(user.user_id, setId, dto.senders);
    }
    async cancelSubscription(setId, user) {
        return this.setsService.cancelSetSubscription(user.user_id, setId);
    }
};
exports.SetsController = SetsController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SetsController.prototype, "listSets", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_set_dto_1.CreateSetDto, Object]),
    __metadata("design:returntype", Promise)
], SetsController.prototype, "createSet", null);
__decorate([
    (0, common_1.Delete)(':setId'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Param)('setId', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], SetsController.prototype, "deleteSet", null);
__decorate([
    (0, common_1.Put)(':setId/senders'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Param)('setId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_senders_dto_1.UpdateSendersDto, Object]),
    __metadata("design:returntype", Promise)
], SetsController.prototype, "updateSenders", null);
__decorate([
    (0, common_1.Post)(':setId/cancel'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Param)('setId', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], SetsController.prototype, "cancelSubscription", null);
exports.SetsController = SetsController = __decorate([
    (0, common_1.Controller)('sets'),
    __metadata("design:paramtypes", [sets_service_1.SetsService])
], SetsController);
//# sourceMappingURL=sets.controller.js.map