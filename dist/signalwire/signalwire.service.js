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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignalwireService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const compatibility_api_1 = require("@signalwire/compatibility-api");
let SignalwireService = class SignalwireService {
    config;
    client = null;
    fromNumber;
    constructor(config) {
        this.config = config;
        const projectId = this.config.get('SIGNALWIRE_PROJECT_ID');
        const token = this.config.get('SIGNALWIRE_API_TOKEN');
        const spaceUrl = this.config.get('SIGNALWIRE_SPACE_URL');
        const from = this.config.get('SIGNALWIRE_FROM_NUMBER') ||
            this.config.get('SIGNALWIRE_PHONE_NUMBER') ||
            '';
        this.fromNumber = from.startsWith('+') ? from : `+${from}`;
        if (projectId && token && spaceUrl && this.fromNumber) {
            this.client = (0, compatibility_api_1.RestClient)(projectId, token, {
                signalwireSpaceUrl: spaceUrl,
            });
        }
        else {
            this.client = null;
        }
    }
    async sendSms(to, body) {
        if (!this.client) {
            throw new Error('SignalWire is not configured. Set SIGNALWIRE_PROJECT_ID, SIGNALWIRE_API_TOKEN, SIGNALWIRE_SPACE_URL, SIGNALWIRE_FROM_NUMBER in .env');
        }
        const normalizedTo = to.startsWith('+') ? to : `+${to}`;
        return new Promise((resolve, reject) => {
            this.client.messages
                .create({
                from: this.fromNumber,
                to: normalizedTo,
                body,
            })
                .then((message) => resolve(message.sid))
                .catch(reject);
        });
    }
};
exports.SignalwireService = SignalwireService;
exports.SignalwireService = SignalwireService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], SignalwireService);
//# sourceMappingURL=signalwire.service.js.map