"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const email_entity_1 = require("./email.entity");
const deleted_email_entity_1 = require("./deleted-email.entity");
const emails_service_1 = require("./emails.service");
const emails_controller_1 = require("./emails.controller");
const auth_module_1 = require("../auth/auth.module");
const user_entity_1 = require("../users/user.entity");
const googleAuth_provider_1 = require("../googleAuth/googleAuth.provider");
const gmail_module_1 = require("../gmail/gmail.module");
const sets_module_1 = require("../sets/sets.module");
let EmailsModule = class EmailsModule {
};
exports.EmailsModule = EmailsModule;
exports.EmailsModule = EmailsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([email_entity_1.Email, deleted_email_entity_1.DeletedEmail, user_entity_1.User]),
            auth_module_1.AuthModule,
            gmail_module_1.GmailModule,
            (0, common_1.forwardRef)(() => sets_module_1.SetsModule),
        ],
        controllers: [emails_controller_1.EmailsController],
        providers: [emails_service_1.EmailsService, googleAuth_provider_1.GoogleAuthProvider],
        exports: [emails_service_1.EmailsService],
    })
], EmailsModule);
//# sourceMappingURL=emails.module.js.map