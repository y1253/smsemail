"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const db_config_module_1 = require("./db-config/db-config.module");
const config_1 = require("@nestjs/config");
const users_module_1 = require("./users/users.module");
const cc_module_1 = require("./cc/cc.module");
const emails_module_1 = require("./emails/emails.module");
const signalwire_module_1 = require("./signalwire/signalwire.module");
const phones_module_1 = require("./phones/phones.module");
const sets_module_1 = require("./sets/sets.module");
const webhooks_module_1 = require("./webhooks/webhooks.module");
const openai_module_1 = require("./openai/openai.module");
const admin_module_1 = require("./admin/admin.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            db_config_module_1.DbConfigModule,
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            schedule_1.ScheduleModule.forRoot(),
            signalwire_module_1.SignalwireModule,
            users_module_1.UsersModule,
            cc_module_1.CcModule,
            emails_module_1.EmailsModule,
            phones_module_1.PhonesModule,
            sets_module_1.SetsModule,
            webhooks_module_1.WebhooksModule,
            openai_module_1.OpenAiModule,
            admin_module_1.AdminModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map