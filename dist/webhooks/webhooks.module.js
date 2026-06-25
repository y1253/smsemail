"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhooksModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const email_entity_1 = require("../emails/email.entity");
const phone_entity_1 = require("../phones/phone.entity");
const email_phone_set_entity_1 = require("../sets/email-phone-set.entity");
const set_allowed_sender_entity_1 = require("../sets/set-allowed-sender.entity");
const income_message_entity_1 = require("../messages/income-message.entity");
const pending_sms_command_entity_1 = require("./pending-sms-command.entity");
const emails_module_1 = require("../emails/emails.module");
const gmail_module_1 = require("../gmail/gmail.module");
const openai_module_1 = require("../openai/openai.module");
const webhooks_service_1 = require("./webhooks.service");
const webhooks_controller_1 = require("./webhooks.controller");
let WebhooksModule = class WebhooksModule {
};
exports.WebhooksModule = WebhooksModule;
exports.WebhooksModule = WebhooksModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([email_entity_1.Email, phone_entity_1.Phone, email_phone_set_entity_1.EmailPhoneSet, set_allowed_sender_entity_1.SetAllowedSender, income_message_entity_1.IncomeMessage, pending_sms_command_entity_1.PendingSmsCommand]),
            emails_module_1.EmailsModule,
            gmail_module_1.GmailModule,
            openai_module_1.OpenAiModule,
        ],
        controllers: [webhooks_controller_1.WebhooksController],
        providers: [webhooks_service_1.WebhooksService],
    })
], WebhooksModule);
//# sourceMappingURL=webhooks.module.js.map