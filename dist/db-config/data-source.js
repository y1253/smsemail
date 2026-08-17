"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const dotenv = __importStar(require("dotenv"));
const typeorm_1 = require("typeorm");
const email_entity_1 = require("../emails/email.entity");
const phone_entity_1 = require("../phones/phone.entity");
const phone_verification_entity_1 = require("../phones/phone-verification.entity");
const transaction_entity_1 = require("../transactions/transaction.entity");
const user_entity_1 = require("../users/user.entity");
const out_message_entity_1 = require("../messages/out-message.entity");
const income_message_entity_1 = require("../messages/income-message.entity");
const subscription_entity_1 = require("../subscriptions/subscription.entity");
const email_phone_set_entity_1 = require("../sets/email-phone-set.entity");
const set_allowed_sender_entity_1 = require("../sets/set-allowed-sender.entity");
const pending_sms_command_entity_1 = require("../webhooks/pending-sms-command.entity");
const deleted_email_entity_1 = require("../emails/deleted-email.entity");
const deleted_phone_entity_1 = require("../phones/deleted-phone.entity");
dotenv.config();
exports.default = new typeorm_1.DataSource({
    type: 'mysql',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    synchronize: false,
    entities: [
        user_entity_1.User, email_entity_1.Email, phone_entity_1.Phone, phone_verification_entity_1.PhoneVerification, transaction_entity_1.Transaction, subscription_entity_1.Subscription,
        income_message_entity_1.IncomeMessage, out_message_entity_1.OutMessage, email_phone_set_entity_1.EmailPhoneSet, set_allowed_sender_entity_1.SetAllowedSender,
        pending_sms_command_entity_1.PendingSmsCommand, deleted_email_entity_1.DeletedEmail, deleted_phone_entity_1.DeletedPhone,
    ],
    migrations: ['src/db-config/migrations/*.ts'],
});
//# sourceMappingURL=data-source.js.map