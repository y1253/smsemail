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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CcService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const stripe_1 = __importDefault(require("stripe"));
const user_entity_1 = require("../users/user.entity");
let CcService = class CcService {
    userRepo;
    config;
    stripe;
    constructor(userRepo, config) {
        this.userRepo = userRepo;
        this.config = config;
        const key = this.config.get('STRIPE_TEST_KEY');
        if (!key)
            throw new Error('STRIPE_TEST_KEY is not set');
        this.stripe = new stripe_1.default(key);
    }
    async attachPaymentMethodForUser(userId, paymentMethodId) {
        const user = await this.userRepo.findOne({ where: { userId } });
        if (!user)
            throw new common_1.BadRequestException('User not found');
        const email = user.email ?? undefined;
        let customerId = user.stripeCustomerId ?? null;
        if (!customerId) {
            const customer = await this.stripe.customers.create({
                email: email || undefined,
                metadata: {
                    user_id: String(userId),
                },
            });
            customerId = customer.id;
        }
        await this.stripe.paymentMethods.attach(paymentMethodId, {
            customer: customerId,
        });
        await this.stripe.customers.update(customerId, {
            invoice_settings: { default_payment_method: paymentMethodId },
        });
        if (!user.stripeCustomerId) {
            user.stripeCustomerId = customerId;
            await this.userRepo.save(user);
        }
        return { stripeCustomerId: customerId };
    }
    async listPaymentMethodsForUser(userId) {
        const user = await this.userRepo.findOne({ where: { userId } });
        if (!user)
            throw new common_1.BadRequestException('User not found');
        if (!user.stripeCustomerId)
            return [];
        const { data } = await this.stripe.paymentMethods.list({
            customer: user.stripeCustomerId,
            type: 'card',
        });
        return data.map((pm) => ({
            id: pm.id,
            brand: pm.card?.brand ?? '',
            last4: pm.card?.last4 ?? '',
            expMonth: pm.card?.exp_month ?? 0,
            expYear: pm.card?.exp_year ?? 0,
        }));
    }
    async deletePaymentMethodForUser(userId, paymentMethodId) {
        const user = await this.userRepo.findOne({ where: { userId } });
        if (!user)
            throw new common_1.BadRequestException('User not found');
        if (!user.stripeCustomerId) {
            throw new common_1.BadRequestException('No saved cards for this user');
        }
        const pm = await this.stripe.paymentMethods.retrieve(paymentMethodId);
        if (pm.customer !== user.stripeCustomerId) {
            throw new common_1.BadRequestException('Card does not belong to this user');
        }
        await this.stripe.paymentMethods.detach(paymentMethodId);
        return { deleted: paymentMethodId };
    }
};
exports.CcService = CcService;
exports.CcService = CcService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        config_1.ConfigService])
], CcService);
//# sourceMappingURL=cc.service.js.map