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
exports.PhonesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("../users/user.entity");
const phone_entity_1 = require("./phone.entity");
const deleted_phone_entity_1 = require("./deleted-phone.entity");
const phone_verification_entity_1 = require("./phone-verification.entity");
const signalwire_service_1 = require("../signalwire/signalwire.service");
const sets_service_1 = require("../sets/sets.service");
const CODE_LENGTH = 6;
const CODE_EXPIRY_MINUTES = 10;
let PhonesService = class PhonesService {
    userRepo;
    phoneRepo;
    deletedPhoneRepo;
    verificationRepo;
    signalwireService;
    setsService;
    constructor(userRepo, phoneRepo, deletedPhoneRepo, verificationRepo, signalwireService, setsService) {
        this.userRepo = userRepo;
        this.phoneRepo = phoneRepo;
        this.deletedPhoneRepo = deletedPhoneRepo;
        this.verificationRepo = verificationRepo;
        this.signalwireService = signalwireService;
        this.setsService = setsService;
    }
    async listPhonesForUser(userId) {
        const phones = await this.phoneRepo.find({
            where: { user: { userId }, deletedAt: (0, typeorm_2.IsNull)() },
            order: { addedAt: 'ASC' },
        });
        return phones.map((p) => ({ phoneId: p.phoneId, phone: p.phone, addedAt: p.addedAt }));
    }
    async sendVerificationCode(userId, phone, consent) {
        const user = await this.userRepo.findOne({ where: { userId } });
        if (!user) {
            throw new common_1.BadRequestException('User not found');
        }
        const code = this.generateCode();
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + CODE_EXPIRY_MINUTES);
        const verification = this.verificationRepo.create({
            userId,
            phone,
            code,
            expiresAt,
            consentAt: consent ? new Date() : null,
        });
        await this.verificationRepo.save(verification);
        const body = `Your verification code is: ${code}. It expires in ${CODE_EXPIRY_MINUTES} minutes.`;
        await this.signalwireService.sendSms(phone, body);
        return { sent: true };
    }
    async verifyCode(userId, phone, code) {
        const user = await this.userRepo.findOne({ where: { userId } });
        if (!user) {
            throw new common_1.BadRequestException('User not found');
        }
        const now = new Date();
        const valid = await this.verificationRepo.findOne({
            where: { userId, phone, code },
        });
        if (!valid) {
            throw new common_1.BadRequestException('Invalid code');
        }
        if (valid.expiresAt < now) {
            throw new common_1.BadRequestException('Code has expired');
        }
        let existing = await this.phoneRepo.findOne({
            where: { user: { userId }, phone },
            relations: ['user'],
        });
        if (existing) {
            existing.deletedAt = null;
            existing.consentAt = valid.consentAt;
            existing.optedOutAt = null;
            await this.phoneRepo.save(existing);
            await this.verificationRepo.delete({ userId, phone });
            return { verified: true, phoneId: existing.phoneId };
        }
        const newPhone = this.phoneRepo.create({
            user,
            phone,
            addedAt: new Date(),
            deletedAt: null,
            consentAt: valid.consentAt,
            optedOutAt: null,
        });
        await this.phoneRepo.save(newPhone);
        await this.verificationRepo.delete({ userId, phone });
        return { verified: true, phoneId: newPhone.phoneId };
    }
    async deletePhoneForUser(userId, phoneId) {
        const phone = await this.phoneRepo.findOne({
            where: { phoneId },
            relations: ['user'],
        });
        if (!phone || phone.user.userId !== userId) {
            throw new common_1.BadRequestException('Phone not found for this user');
        }
        if (phone.deletedAt) {
            return { deleted: true, phoneId: phone.phoneId };
        }
        await this.setsService.teardownSetsForPhone(userId, phoneId);
        await this.deletedPhoneRepo.save(this.deletedPhoneRepo.create({
            userId,
            originalPhoneId: phone.phoneId,
            phone: phone.phone,
            createdAt: phone.addedAt,
            deletedAt: new Date(),
        }));
        phone.deletedAt = new Date();
        await this.phoneRepo.save(phone);
        return { deleted: true, phoneId: phone.phoneId };
    }
    generateCode() {
        const digits = '0123456789';
        let code = '';
        for (let i = 0; i < CODE_LENGTH; i++) {
            code += digits[Math.floor(Math.random() * digits.length)];
        }
        return code;
    }
};
exports.PhonesService = PhonesService;
exports.PhonesService = PhonesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(phone_entity_1.Phone)),
    __param(2, (0, typeorm_1.InjectRepository)(deleted_phone_entity_1.DeletedPhone)),
    __param(3, (0, typeorm_1.InjectRepository)(phone_verification_entity_1.PhoneVerification)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        signalwire_service_1.SignalwireService,
        sets_service_1.SetsService])
], PhonesService);
//# sourceMappingURL=phones.service.js.map