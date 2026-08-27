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
var AdminService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("../users/user.entity");
const email_phone_set_entity_1 = require("../sets/email-phone-set.entity");
const deleted_email_entity_1 = require("../emails/deleted-email.entity");
const deleted_phone_entity_1 = require("../phones/deleted-phone.entity");
const billing_service_1 = require("../billing/billing.service");
const ADMIN_INVOICE_LIMIT = 100;
function earliestRenewal(sets) {
    const dates = sets
        .filter((s) => !s.promo)
        .map((s) => s.renewsAt)
        .filter((d) => !!d);
    return dates.length ? new Date(Math.min(...dates.map((d) => +d))) : null;
}
function earliestEnd(sets) {
    const dates = sets.map((s) => s.endsAt).filter((d) => !!d);
    return dates.length ? new Date(Math.min(...dates.map((d) => +d))) : null;
}
let AdminService = AdminService_1 = class AdminService {
    userRepo;
    setRepo;
    deletedEmailRepo;
    deletedPhoneRepo;
    billingService;
    logger = new common_1.Logger(AdminService_1.name);
    constructor(userRepo, setRepo, deletedEmailRepo, deletedPhoneRepo, billingService) {
        this.userRepo = userRepo;
        this.setRepo = setRepo;
        this.deletedEmailRepo = deletedEmailRepo;
        this.deletedPhoneRepo = deletedPhoneRepo;
        this.billingService = billingService;
    }
    async getDeletedContacts() {
        const [emails, phones] = await Promise.all([
            this.deletedEmailRepo.find({ order: { deletedAt: 'DESC' } }),
            this.deletedPhoneRepo.find({ order: { deletedAt: 'DESC' } }),
        ]);
        return {
            emails: emails.map((e) => ({
                userId: e.userId,
                value: e.email,
                originalId: e.originalEmailId,
                createdAt: e.createdAt,
                deletedAt: e.deletedAt,
            })),
            phones: phones.map((p) => ({
                userId: p.userId,
                value: p.phone,
                originalId: p.originalPhoneId,
                createdAt: p.createdAt,
                deletedAt: p.deletedAt,
            })),
        };
    }
    async getAllAccounts() {
        const users = await this.userRepo
            .createQueryBuilder('user')
            .leftJoinAndSelect('user.emails', 'email', 'email.deleted_at IS NULL')
            .leftJoinAndSelect('user.phones', 'phone', 'phone.deleted_at IS NULL')
            .orderBy('user.create_at', 'DESC')
            .getMany();
        const allSets = await this.setRepo
            .createQueryBuilder('set')
            .innerJoin('set.email', 'email')
            .select('email.user_id', 'userId')
            .addSelect('set.set_id', 'setId')
            .addSelect('set.stripe_subscription_id', 'stripeSubscriptionId')
            .addSelect('set.pending_cancel_at', 'pendingCancelAt')
            .addSelect('set.deleted_at', 'deletedAt')
            .getRawMany();
        const setsByUser = new Map();
        for (const row of allSets) {
            const key = Number(row.userId);
            const list = setsByUser.get(key);
            if (list)
                list.push(row);
            else
                setsByUser.set(key, [row]);
        }
        const { subs, error: subscriptionsError } = await this.billingService.loadAllStripeSubscriptions();
        return users.map((u) => {
            const mine = setsByUser.get(u.userId) ?? [];
            const states = mine.map((row) => {
                const promo = row.stripeSubscriptionId === 'PROMO';
                const sub = !promo && row.stripeSubscriptionId
                    ? (subs.get(row.stripeSubscriptionId) ?? null)
                    : null;
                return {
                    promo,
                    live: !row.deletedAt,
                    ...this.billingService.describeSubscription(sub, {
                        deletedAt: row.deletedAt,
                        pendingCancelAt: row.pendingCancelAt,
                    }),
                };
            });
            const live = states.filter((s) => s.live);
            return {
                userId: u.userId,
                name: [u.firstName, u.lastName].filter(Boolean).join(' ') || '—',
                email: u.email,
                authType: u.authType,
                createdAt: u.createdAt,
                active: u.active,
                setCount: live.length,
                nextRenewalAt: earliestRenewal(live),
                pendingCancelAt: earliestEnd(live),
                pendingCancelCount: live.filter((s) => s.status === 'pending_cancel')
                    .length,
                promoCount: live.filter((s) => s.promo).length,
                cancelledCount: states.filter((s) => s.status === 'cancelled').length,
                subscriptionsError,
                emails: u.emails.map((e) => e.email),
                phones: u.phones.map((p) => p.phone),
            };
        });
    }
    async getAccountDetail(userId) {
        const user = await this.userRepo
            .createQueryBuilder('user')
            .leftJoinAndSelect('user.emails', 'email')
            .leftJoinAndSelect('user.phones', 'phone')
            .where('user.user_id = :userId', { userId })
            .getOne();
        if (!user) {
            throw new common_1.NotFoundException('Account not found');
        }
        const sets = await this.setRepo
            .createQueryBuilder('set')
            .leftJoinAndSelect('set.email', 'email')
            .leftJoinAndSelect('set.phone', 'phone')
            .where('email.user_id = :userId', { userId })
            .orderBy('set.created_at', 'DESC')
            .getMany();
        const [{ transactions, transactionsError }, { subs, error: subsError }] = await Promise.all([
            this.loadTransactions(userId),
            this.billingService.loadStripeSubscriptions(user.stripeCustomerId),
        ]);
        const mappedSets = sets.map((s) => {
            const promo = s.stripeSubscriptionId === 'PROMO';
            const sub = !promo && s.stripeSubscriptionId
                ? (subs.get(s.stripeSubscriptionId) ?? null)
                : null;
            const state = this.billingService.describeSubscription(sub, s);
            return {
                setId: s.setId,
                createdAt: s.createdAt,
                deletedAt: s.deletedAt,
                stripeSubscriptionId: s.stripeSubscriptionId,
                pendingCancelAt: s.pendingCancelAt,
                email: s.email?.email ?? null,
                phone: s.phone?.phone ?? null,
                promo,
                ...state,
                amount: promo ? 0 : state.amount,
                currency: promo ? null : state.currency,
                interval: promo ? null : state.interval,
            };
        });
        const nextRenewalAt = earliestRenewal(mappedSets);
        return {
            userId: user.userId,
            name: [user.firstName, user.lastName].filter(Boolean).join(' ') || '—',
            email: user.email,
            authType: user.authType,
            createdAt: user.createdAt,
            active: user.active,
            stripeCustomerId: user.stripeCustomerId,
            emails: user.emails.map((e) => ({
                email: e.email,
                addedAt: e.addedAt,
                deletedAt: e.deletedAt,
            })),
            phones: user.phones.map((p) => ({
                phone: p.phone,
                addedAt: p.addedAt,
                deletedAt: p.deletedAt,
            })),
            sets: mappedSets,
            setCounts: {
                total: mappedSets.length,
                active: mappedSets.filter((s) => s.status !== 'cancelled').length,
            },
            nextRenewalAt,
            transactions,
            transactionsError,
            subscriptionsError: subsError,
        };
    }
    async loadTransactions(userId) {
        try {
            const page = await this.billingService.listInvoicesForUser(userId, {
                limit: ADMIN_INVOICE_LIMIT,
            });
            return { transactions: page.data, transactionsError: null };
        }
        catch (err) {
            this.logger.error(`Stripe invoice list failed for user ${userId}: ${err}`);
            return {
                transactions: [],
                transactionsError: err?.response?.message ?? 'Could not load transactions from Stripe',
            };
        }
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = AdminService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(email_phone_set_entity_1.EmailPhoneSet)),
    __param(2, (0, typeorm_1.InjectRepository)(deleted_email_entity_1.DeletedEmail)),
    __param(3, (0, typeorm_1.InjectRepository)(deleted_phone_entity_1.DeletedPhone)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        billing_service_1.BillingService])
], AdminService);
//# sourceMappingURL=admin.service.js.map