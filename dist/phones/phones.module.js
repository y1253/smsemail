"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhonesModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const user_entity_1 = require("../users/user.entity");
const phone_entity_1 = require("./phone.entity");
const phone_verification_entity_1 = require("./phone-verification.entity");
const phones_service_1 = require("./phones.service");
const phones_controller_1 = require("./phones.controller");
const auth_module_1 = require("../auth/auth.module");
const signalwire_module_1 = require("../signalwire/signalwire.module");
let PhonesModule = class PhonesModule {
};
exports.PhonesModule = PhonesModule;
exports.PhonesModule = PhonesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([user_entity_1.User, phone_entity_1.Phone, phone_verification_entity_1.PhoneVerification]),
            auth_module_1.AuthModule,
            signalwire_module_1.SignalwireModule,
        ],
        controllers: [phones_controller_1.PhonesController],
        providers: [phones_service_1.PhonesService],
    })
], PhonesModule);
//# sourceMappingURL=phones.module.js.map