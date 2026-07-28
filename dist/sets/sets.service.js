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
const set_allowed_sender_entity_1 = require("./set-allowed-sender.entity");
const emails_service_1 = require("../emails/emails.service");
const gmail_service_1 = require("../gmail/gmail.service");
const signalwire_service_1 = require("../signalwire/signalwire.service");
let SetsService = SetsService_1 = class SetsService {
    userRepo;
    emailRepo;
    phoneRepo;
    setRepo;
    senderRepo;
    config;
    emailsService;
    gmailService;
    signalwireService;
    stripe;
    logger = new common_1.Logger(SetsService_1.name);
    constructor(userRepo, emailRepo, phoneRepo, setRepo, senderRepo, config, emailsService, gmailService, signalwireService) {
        this.userRepo = userRepo;
        this.emailRepo = emailRepo;
        this.phoneRepo = phoneRepo;
        this.setRepo = setRepo;
        this.senderRepo = senderRepo;
        this.config = config;
        this.emailsService = emailsService;
        this.gmailService = gmailService;
        this.signalwireService = signalwireService;
        const key = this.config.get('STRIPE_TEST_KEY');
        if (!key)
            throw new Error('STRIPE_TEST_KEY is not set');
        this.stripe = new stripe_1.default(key);
    }
    async listSetsForUser(userId) {
        const sets = await this.setRepo.find({
            where: { email: { user: { userId } }, deletedAt: (0, typeorm_2.IsNull)() },
            relations: ['email', 'phone', 'allowedSenders'],
            order: { createdAt: 'ASC' },
        });
        return sets.map((s) => ({
            setId: s.setId,
            createdAt: s.createdAt,
            pendingCancelAt: s.pendingCancelAt,
            email: { emailId: s.email.emailId, email: s.email.email },
            phone: { phoneId: s.phone.phoneId, phone: s.phone.phone },
            allowedSenders: (s.allowedSenders ?? []).map((a) => a.email),
            stripeSubscriptionId: s.stripeSubscriptionId,
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
        await this.teardownSet(set);
        return { deleted: true };
    }
    async teardownSet(set) {
        if (set.stripeSubscriptionId && set.stripeSubscriptionId !== 'PROMO') {
            try {
                await this.stripe.subscriptions.cancel(set.stripeSubscriptionId);
            }
            catch (err) {
                this.logger.error(`Failed to cancel Stripe subscription ${set.stripeSubscriptionId}: ${err}`);
            }
        }
        if (set.email?.refreshToken) {
            try {
                const refreshToken = this.emailsService.decrypt(set.email.refreshToken);
                await this.gmailService.unwatchGmail(refreshToken);
            }
            catch (err) {
                this.logger.error(`Failed to unwatch Gmail for set ${set.setId}: ${err}`);
            }
        }
        set.deletedAt = new Date();
        set.pendingCancelAt = null;
        await this.setRepo.save(set);
    }
    async teardownSetsForEmail(userId, emailId) {
        const sets = await this.setRepo.find({
            where: { email: { emailId, user: { userId } }, deletedAt: (0, typeorm_2.IsNull)() },
            relations: ['email', 'email.user', 'phone'],
        });
        for (const set of sets) {
            await this.teardownSet(set);
        }
        return sets.length;
    }
    async teardownSetsForPhone(userId, phoneId) {
        const sets = await this.setRepo.find({
            where: { phone: { phoneId }, email: { user: { userId } }, deletedAt: (0, typeorm_2.IsNull)() },
            relations: ['email', 'email.user', 'phone'],
        });
        for (const set of sets) {
            await this.teardownSet(set);
        }
        return sets.length;
    }
    isPromoValid(promoCode) {
        const validPromo = this.config.get('PROMO_CODE');
        if (!validPromo || !promoCode)
            return false;
        return promoCode.trim().toLowerCase() === validPromo.trim().toLowerCase();
    }
    validatePromo(promoCode) {
        return { valid: this.isPromoValid(promoCode) };
    }
    resolveCancelAt(sub) {
        const ts = sub.cancel_at ?? sub.items?.data?.[0]?.current_period_end ?? null;
        return ts ? new Date(ts * 1000) : null;
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
        const promoValid = this.isPromoValid(promoCode);
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
                throw new common_1.BadRequestException('Billing is not configured (STRIPE_PRICE_ID missing)');
            try {
                const subscription = await this.stripe.subscriptions.create({
                    customer: user.stripeCustomerId,
                    items: [{ price: priceId }],
                });
                subscriptionId = subscription.id;
            }
            catch (err) {
                this.logger.error(`Stripe subscription create failed: ${err}`);
                throw new common_1.BadRequestException(err?.raw?.message ?? 'Failed to start subscription — check your payment method');
            }
        }
        if (existing) {
            if (existing.deletedAt) {
                existing.deletedAt = null;
                existing.pendingCancelAt = null;
                existing.createdAt = now;
                existing.stripeSubscriptionId = subscriptionId;
                await this.setRepo.save(existing);
                await this.refreshGmailWatch(email);
                await this.signalwireService.sendSms(phone.phone, "SMSMail: You're subscribed to email-to-SMS alerts. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to unsubscribe.");
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
        await this.signalwireService.sendSms(phone.phone, 'Welcome! Your emails will be forwarded here as SMS summaries.\nText HELP anytime to see available commands.');
        return { setId: saved.setId };
    }
    async cancelSetSubscription(userId, setId) {
        const set = await this.setRepo.findOne({
            where: { setId, deletedAt: (0, typeorm_2.IsNull)() },
            relations: ['email', 'email.user'],
        });
        if (!set || set.email.user.userId !== userId) {
            throw new common_1.BadRequestException('Set not found for this user');
        }
        if (!set.stripeSubscriptionId || set.stripeSubscriptionId === 'PROMO') {
            throw new common_1.BadRequestException('No paid subscription to cancel');
        }
        if (set.pendingCancelAt) {
            throw new common_1.BadRequestException('Subscription is already scheduled for cancellation');
        }
        const sub = await this.stripe.subscriptions.update(set.stripeSubscriptionId, {
            cancel_at_period_end: true,
        });
        set.pendingCancelAt = this.resolveCancelAt(sub);
        await this.setRepo.save(set);
        return { cancelAt: set.pendingCancelAt };
    }
    async resumeSetSubscription(userId, setId) {
        const set = await this.setRepo.findOne({
            where: { setId, deletedAt: (0, typeorm_2.IsNull)() },
            relations: ['email', 'email.user'],
        });
        if (!set || set.email.user.userId !== userId) {
            throw new common_1.BadRequestException('Set not found for this user');
        }
        if (!set.stripeSubscriptionId || set.stripeSubscriptionId === 'PROMO') {
            throw new common_1.BadRequestException('No paid subscription to resume');
        }
        if (!set.pendingCancelAt) {
            throw new common_1.BadRequestException('Subscription is not scheduled for cancellation');
        }
        const user = await this.userRepo.findOne({ where: { userId } });
        if (!user?.stripeCustomerId) {
            throw new common_1.BadRequestException('Add a payment method before resuming');
        }
        const { data: cards } = await this.stripe.paymentMethods.list({
            customer: user.stripeCustomerId,
            type: 'card',
            limit: 1,
        });
        if (cards.length === 0) {
            throw new common_1.BadRequestException('Add a payment method before resuming');
        }
        let sub;
        try {
            sub = await this.stripe.subscriptions.update(set.stripeSubscriptionId, {
                cancel_at_period_end: false,
            });
        }
        catch (err) {
            this.logger.error(`Stripe resume failed for ${set.stripeSubscriptionId}: ${err}`);
            throw new common_1.BadRequestException('This subscription has already ended — create the set again to restart it');
        }
        set.pendingCancelAt = null;
        await this.setRepo.save(set);
        return { resumed: true, nextBillingAt: this.resolveCancelAt(sub) };
    }
    async updateSenders(userId, setId, senders) {
        const set = await this.setRepo.findOne({
            where: { setId, deletedAt: (0, typeorm_2.IsNull)() },
            relations: ['email', 'email.user'],
        });
        if (!set || set.email.user.userId !== userId) {
            throw new common_1.BadRequestException('Set not found for this user');
        }
        await this.senderRepo.delete({ set: { setId } });
        if (senders.length > 0) {
            const rows = senders.map((email) => this.senderRepo.create({ set, email: email.toLowerCase().trim() }));
            await this.senderRepo.save(rows);
        }
        return { updated: true };
    }
    async refreshGmailWatch(email) {
        if (!email.refreshToken)
            return;
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
    __param(4, (0, typeorm_1.InjectRepository)(set_allowed_sender_entity_1.SetAllowedSender)),
    __param(6, (0, common_1.Inject)((0, common_1.forwardRef)(() => emails_service_1.EmailsService))),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        config_1.ConfigService,
        emails_service_1.EmailsService,
        gmail_service_1.GmailService,
        signalwire_service_1.SignalwireService])
], SetsService);
//# sourceMappingURL=sets.service.js.map