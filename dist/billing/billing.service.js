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
var BillingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const stripe_1 = __importDefault(require("stripe"));
const user_entity_1 = require("../users/user.entity");
const email_phone_set_entity_1 = require("../sets/email-phone-set.entity");
const DEFAULT_INVOICE_LIMIT = 24;
let BillingService = BillingService_1 = class BillingService {
    userRepo;
    setRepo;
    config;
    stripe;
    logger = new common_1.Logger(BillingService_1.name);
    constructor(userRepo, setRepo, config) {
        this.userRepo = userRepo;
        this.setRepo = setRepo;
        this.config = config;
        const key = this.config.get('STRIPE_TEST_KEY');
        if (!key)
            throw new Error('STRIPE_TEST_KEY is not set');
        this.stripe = new stripe_1.default(key);
    }
    async listInvoicesForUser(userId, dto) {
        const user = await this.userRepo.findOne({ where: { userId } });
        if (!user)
            throw new common_1.BadRequestException('User not found');
        if (!user.stripeCustomerId) {
            return { data: [], hasMore: false, nextCursor: null };
        }
        let page;
        try {
            page = await this.stripe.invoices.list({
                customer: user.stripeCustomerId,
                limit: dto.limit ?? DEFAULT_INVOICE_LIMIT,
                ...(dto.startingAfter ? { starting_after: dto.startingAfter } : {}),
            });
        }
        catch (err) {
            this.logger.error(`Stripe invoice list failed: ${err}`);
            throw new common_1.BadRequestException(err?.raw?.message ?? 'Could not load transactions');
        }
        const data = page.data.map((inv) => this.toBillingInvoice(inv));
        return {
            data,
            hasMore: page.has_more,
            nextCursor: page.has_more ? (data[data.length - 1]?.id ?? null) : null,
        };
    }
    toBillingInvoice(inv) {
        const status = inv.status ?? 'draft';
        const paidAt = inv.status_transitions?.paid_at ?? null;
        return {
            id: inv.id ?? '',
            number: inv.number ?? null,
            status,
            amount: status === 'paid' ? inv.amount_paid : inv.amount_due,
            currency: inv.currency,
            created: new Date(inv.created * 1000),
            paidAt: paidAt ? new Date(paidAt * 1000) : null,
            description: inv.lines?.data?.[0]?.description ?? null,
            subscriptionId: this.resolveInvoiceSubscriptionId(inv),
            hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
            invoicePdf: inv.invoice_pdf ?? null,
        };
    }
    resolveInvoiceSubscriptionId(inv) {
        const fromParent = inv.parent?.subscription_details?.subscription;
        const raw = fromParent ?? inv.subscription ?? null;
        if (!raw)
            return null;
        return typeof raw === 'string' ? raw : (raw.id ?? null);
    }
    async listSubscriptionsForUser(userId) {
        const user = await this.userRepo.findOne({ where: { userId } });
        if (!user)
            throw new common_1.BadRequestException('User not found');
        const sets = await this.setRepo.find({
            where: { email: { user: { userId } }, deletedAt: (0, typeorm_2.IsNull)() },
            relations: ['email', 'phone'],
            order: { createdAt: 'ASC' },
        });
        const subs = await this.loadStripeSubscriptions(user.stripeCustomerId);
        return sets.map((s) => {
            const promo = s.stripeSubscriptionId === 'PROMO';
            const sub = !promo && s.stripeSubscriptionId
                ? (subs.get(s.stripeSubscriptionId) ?? null)
                : null;
            const item = sub?.items?.data?.[0] ?? null;
            const price = item?.price ?? null;
            return {
                setId: s.setId,
                email: s.email.email,
                phone: s.phone.phone,
                createdAt: s.createdAt,
                status: s.pendingCancelAt ? 'pending_cancel' : 'active',
                promo,
                stripeSubscriptionId: s.stripeSubscriptionId,
                pendingCancelAt: s.pendingCancelAt,
                currentPeriodEnd: this.resolvePeriodEnd(sub, s.pendingCancelAt),
                stripeStatus: sub?.status ?? null,
                amount: promo ? 0 : (price?.unit_amount ?? null),
                currency: promo ? null : (price?.currency ?? null),
                interval: promo ? null : (price?.recurring?.interval ?? null),
            };
        });
    }
    async loadStripeSubscriptions(customerId) {
        const map = new Map();
        if (!customerId)
            return map;
        try {
            const { data } = await this.stripe.subscriptions.list({
                customer: customerId,
                status: 'all',
                limit: 100,
            });
            for (const sub of data)
                map.set(sub.id, sub);
        }
        catch (err) {
            this.logger.error(`Stripe subscription list failed: ${err}`);
        }
        return map;
    }
    resolvePeriodEnd(sub, pendingCancelAt) {
        if (!sub)
            return pendingCancelAt;
        const ts = sub.cancel_at ?? sub.items?.data?.[0]?.current_period_end ?? null;
        return ts ? new Date(ts * 1000) : pendingCancelAt;
    }
};
exports.BillingService = BillingService;
exports.BillingService = BillingService = BillingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(email_phone_set_entity_1.EmailPhoneSet)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        config_1.ConfigService])
], BillingService);
//# sourceMappingURL=billing.service.js.map