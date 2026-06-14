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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var SetsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const config_1 = require("@nestjs/config");
const stripe_1 = __importDefault(require("stripe"));
const user_entity_1 = require("../users/user.entity");
const email_entity_1 = require("../emails/email.entity");
const phone_entity_1 = require("../phones/phone.entity");
const email_phone_set_entity_1 = require("./email-phone-set.entity");
const emails_service_1 = require("../emails/emails.service");
const gmail_service_1 = require("../gmail/gmail.service");
let SetsService = SetsService_1 = class SetsService {
    userRepo;
    emailRepo;
    phoneRepo;
    setRepo;
    config;
    emailsService;
    gmailService;
    stripe;
    logger = new common_1.Logger(SetsService_1.name);
    constructor(userRepo, emailRepo, phoneRepo, setRepo, config, emailsService, gmailService) {
        this.userRepo = userRepo;
        this.emailRepo = emailRepo;
        this.phoneRepo = phoneRepo;
        this.setRepo = setRepo;
        this.config = config;
        this.emailsService = emailsService;
        this.gmailService = gmailService;
        const key = this.config.get('STRIPE_TEST_KEY');
        if (!key)
            throw new Error('STRIPE_TEST_KEY is not set');
        this.stripe = new stripe_1.default(key);
    }
    async listSetsForUser(userId) {
        const sets = await this.setRepo.find({
            where: { email: { user: { userId } }, deletedAt: (0, typeorm_2.IsNull)() },
            relations: ['email', 'phone'],
            order: { createdAt: 'ASC' },
        });
        return sets.map((s) => ({
            setId: s.setId,
            createdAt: s.createdAt,
            email: { emailId: s.email.emailId, email: s.email.email },
            phone: { phoneId: s.phone.phoneId, phone: s.phone.phone },
        }));
    }
    async deleteSetForUser(userId, setId) {
        const set = await this.setRepo.findOne({
            where: { setId, deletedAt: (0, typeorm_2.IsNull)() },
            relations: ['email', 'email.user', 'phone'],
        });
        if (!set || set.email.user.userId !== userId) {
            throw new common_1.BadRequestException('Set not found for this user');
        }
        if (set.stripeSubscriptionId && set.stripeSubscriptionId !== 'PROMO') {
            try {
                await this.stripe.subscriptions.cancel(set.stripeSubscriptionId);
            }
            catch (err) {
                this.logger.error(`Failed to cancel Stripe subscription ${set.stripeSubscriptionId}: ${err}`);
            }
        }
        try {
            const refreshToken = this.emailsService.decrypt(set.email.refreshToken);
            await this.gmailService.unwatchGmail(refreshToken);
        }
        catch (err) {
            this.logger.error(`Failed to unwatch Gmail for set ${setId}: ${err}`);
        }
        set.deletedAt = new Date();
        await this.setRepo.save(set);
        return { deleted: true };
    }
    async createSetForUser(userId, emailId, phoneId, promoCode) {
        const user = await this.userRepo.findOne({ where: { userId } });
        if (!user) {
            throw new common_1.BadRequestException('User not found');
        }
        const email = await this.emailRepo.findOne({
            where: { emailId, user: { userId } },
            relations: ['user'],
        });
        if (!email) {
            throw new common_1.BadRequestException('Email not found for this user');
        }
        const phone = await this.phoneRepo.findOne({
            where: { phoneId, user: { userId } },
            relations: ['user'],
        });
        if (!phone) {
            throw new common_1.BadRequestException('Phone not found for this user');
        }
        const validPromo = this.config.get('PROMO_CODE');
        const promoValid = !!promoCode && promoCode === validPromo;
        if (!promoValid && !user.stripeCustomerId) {
            throw new common_1.BadRequestException('Add a payment method before creating a set');
        }
        const now = new Date();
        const existing = await this.setRepo.findOne({
            where: { email: { emailId }, phone: { phoneId } },
            relations: ['email', 'phone'],
        });
        let subscriptionId;
        if (promoValid) {
            subscriptionId = 'PROMO';
        }
        else {
            const priceId = this.config.get('STRIPE_PRICE_ID');
            if (!priceId)
                throw new Error('STRIPE_PRICE_ID is not set');
            const subscription = await this.stripe.subscriptions.create({
                customer: user.stripeCustomerId,
                items: [{ price: priceId }],
            });
            subscriptionId = subscription.id;
        }
        if (existing) {
            if (existing.deletedAt) {
                existing.deletedAt = null;
                existing.createdAt = now;
                existing.stripeSubscriptionId = subscriptionId;
                await this.setRepo.save(existing);
                await this.refreshGmailWatch(email);
                return { setId: existing.setId };
            }
            if (!promoValid) {
                await this.stripe.subscriptions.cancel(subscriptionId);
            }
            throw new common_1.BadRequestException('Set already exists for this email and phone');
        }
        const set = this.setRepo.create({
            email,
            phone,
            createdAt: now,
            deletedAt: null,
            stripeSubscriptionId: subscriptionId,
        });
        const saved = await this.setRepo.save(set);
        await this.refreshGmailWatch(email);
        return { setId: saved.setId };
    }
    async refreshGmailWatch(email) {
        try {
            const refreshToken = this.emailsService.decrypt(email.refreshToken);
            const { historyId, expiry } = await this.gmailService.watchGmail(refreshToken);
            email.lastHistoryId = historyId;
            email.watchExpiry = expiry;
            await this.emailRepo.save(email);
        }
        catch (err) {
            this.logger.error(`Failed to re-watch Gmail for email ${email.emailId}: ${err}`);
        }
    }
};
exports.SetsService = SetsService;
exports.SetsService = SetsService = SetsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(email_entity_1.Email)),
    __param(2, (0, typeorm_1.InjectRepository)(phone_entity_1.Phone)),
    __param(3, (0, typeorm_1.InjectRepository)(email_phone_set_entity_1.EmailPhoneSet)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        config_1.ConfigService,
        emails_service_1.EmailsService,
        gmail_service_1.GmailService])
], SetsService);
//# sourceMappingURL=sets.service.js.map