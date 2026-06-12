"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbConfigModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const email_entity_1 = require("../emails/email.entity");
const phone_entity_1 = require("../phones/phone.entity");
const phone_verification_entity_1 = require("../phones/phone-verification.entity");
const transaction_entity_1 = require("../transactions/transaction.entity");
const user_entity_1 = require("../users/user.entity");
const out_message_entity_1 = require("../messages/out-message.entity");
const income_message_entity_1 = require("../messages/income-message.entity");
const subscription_entity_1 = require("../subscriptions/subscription.entity");
const email_phone_set_entity_1 = require("../sets/email-phone-set.entity");
let DbConfigModule = class DbConfigModule {
};
exports.DbConfigModule = DbConfigModule;
exports.DbConfigModule = DbConfigModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forRoot({
                type: 'mysql',
                driver: require('mysql2'),
                host: 'localhost',
                port: 3306,
                username: 'yg',
                password: '12345',
                database: 'smsemail',
                synchronize: true,
                entities: [user_entity_1.User, email_entity_1.Email, phone_entity_1.Phone, phone_verification_entity_1.PhoneVerification, transaction_entity_1.Transaction, subscription_entity_1.Subscription, income_message_entity_1.IncomeMessage, out_message_entity_1.OutMessage, email_phone_set_entity_1.EmailPhoneSet],
            }),
        ],
        exports: [typeorm_1.TypeOrmModule],
    })
], DbConfigModule);
//# sourceMappingURL=db-config.module.js.map