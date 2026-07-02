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
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("../users/user.entity");
const email_phone_set_entity_1 = require("../sets/email-phone-set.entity");
const transaction_entity_1 = require("../transactions/transaction.entity");
let AdminService = class AdminService {
    userRepo;
    setRepo;
    transactionRepo;
    constructor(userRepo, setRepo, transactionRepo) {
        this.userRepo = userRepo;
        this.setRepo = setRepo;
        this.transactionRepo = transactionRepo;
    }
    async getAllAccounts() {
        const users = await this.userRepo
            .createQueryBuilder('user')
            .leftJoinAndSelect('user.emails', 'email', 'email.deleted_at IS NULL')
            .leftJoinAndSelect('user.phones', 'phone', 'phone.deleted_at IS NULL')
            .orderBy('user.create_at', 'DESC')
            .getMany();
        const setCountRows = await this.setRepo
            .createQueryBuilder('set')
            .innerJoin('set.email', 'email')
            .select('email.user_id', 'userId')
            .addSelect('COUNT(set.set_id)', 'count')
            .where('set.deleted_at IS NULL')
            .groupBy('email.user_id')
            .getRawMany();
        const setCountByUser = new Map(setCountRows.map((r) => [Number(r.userId), Number(r.count)]));
        return users.map((u) => ({
            userId: u.userId,
            name: [u.firstName, u.lastName].filter(Boolean).join(' ') || '—',
            email: u.email,
            authType: u.authType,
            createdAt: u.createdAt,
            active: u.active,
            setCount: setCountByUser.get(u.userId) ?? 0,
            emails: u.emails.map((e) => e.email),
            phones: u.phones.map((p) => p.phone),
        }));
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
        const transactions = await this.transactionRepo
            .createQueryBuilder('transaction')
            .where('transaction.user_id = :userId', { userId })
            .orderBy('transaction.created_at', 'DESC')
            .getMany();
        const mappedSets = sets.map((s) => ({
            setId: s.setId,
            createdAt: s.createdAt,
            deletedAt: s.deletedAt,
            stripeSubscriptionId: s.stripeSubscriptionId,
            pendingCancelAt: s.pendingCancelAt,
            email: s.email?.email ?? null,
            phone: s.phone?.phone ?? null,
            promo: s.stripeSubscriptionId === 'PROMO',
            status: s.deletedAt
                ? 'cancelled'
                : s.pendingCancelAt
                    ? 'pending_cancel'
                    : 'active',
        }));
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
            transactions: transactions.map((t) => ({
                amount: t.amount,
                createdAt: t.createdAt,
            })),
        };
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(email_phone_set_entity_1.EmailPhoneSet)),
    __param(2, (0, typeorm_1.InjectRepository)(transaction_entity_1.Transaction)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], AdminService);
//# sourceMappingURL=admin.service.js.map