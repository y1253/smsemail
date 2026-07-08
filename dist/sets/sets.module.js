"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const user_entity_1 = require("../users/user.entity");
const email_entity_1 = require("../emails/email.entity");
const phone_entity_1 = require("../phones/phone.entity");
const email_phone_set_entity_1 = require("./email-phone-set.entity");
const set_allowed_sender_entity_1 = require("./set-allowed-sender.entity");
const sets_service_1 = require("./sets.service");
const sets_controller_1 = require("./sets.controller");
const auth_module_1 = require("../auth/auth.module");
const emails_module_1 = require("../emails/emails.module");
const gmail_module_1 = require("../gmail/gmail.module");
let SetsModule = class SetsModule {
};
exports.SetsModule = SetsModule;
exports.SetsModule = SetsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([user_entity_1.User, email_entity_1.Email, phone_entity_1.Phone, email_phone_set_entity_1.EmailPhoneSet, set_allowed_sender_entity_1.SetAllowedSender]),
            auth_module_1.AuthModule,
            (0, common_1.forwardRef)(() => emails_module_1.EmailsModule),
            gmail_module_1.GmailModule,
        ],
        controllers: [sets_controller_1.SetsController],
        providers: [sets_service_1.SetsService],
        exports: [sets_service_1.SetsService],
    })
], SetsModule);
//# sourceMappingURL=sets.module.js.map