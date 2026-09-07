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
var SignalwireService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignalwireService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const compatibility_api_1 = require("@signalwire/compatibility-api");
const MAX_VALIDITY_SECONDS = 172800;
const DEFAULT_VALIDITY_SECONDS = MAX_VALIDITY_SECONDS;
let SignalwireService = SignalwireService_1 = class SignalwireService {
    config;
    logger = new common_1.Logger(SignalwireService_1.name);
    client = null;
    fromNumber;
    validitySeconds;
    constructor(config) {
        this.config = config;
        const projectId = this.config.get('SIGNALWIRE_PROJECT_ID');
        const token = this.config.get('SIGNALWIRE_API_TOKEN');
        const spaceUrl = this.config.get('SIGNALWIRE_SPACE_URL');
        const from = this.config.get('SIGNALWIRE_FROM_NUMBER') ||
            this.config.get('SIGNALWIRE_PHONE_NUMBER') ||
            '';
        this.fromNumber = from.startsWith('+') ? from : `+${from}`;
        this.validitySeconds = this.resolveValiditySeconds();
        if (projectId && token && spaceUrl && this.fromNumber) {
            this.client = (0, compatibility_api_1.RestClient)(projectId, token, {
                signalwireSpaceUrl: spaceUrl,
            });
        }
        else {
            this.client = null;
        }
    }
    resolveValiditySeconds() {
        const raw = this.config.get('SIGNALWIRE_VALIDITY_SECONDS');
        if (raw === undefined || raw === null || String(raw).trim() === '')
            return DEFAULT_VALIDITY_SECONDS;
        const parsed = Number(raw);
        if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
            this.logger.warn(`SIGNALWIRE_VALIDITY_SECONDS="${raw}" is not an integer — falling back to ${DEFAULT_VALIDITY_SECONDS}s.`);
            return DEFAULT_VALIDITY_SECONDS;
        }
        if (parsed < 1 || parsed > MAX_VALIDITY_SECONDS) {
            const clamped = Math.min(Math.max(parsed, 1), MAX_VALIDITY_SECONDS);
            this.logger.warn(`SIGNALWIRE_VALIDITY_SECONDS=${parsed} is outside SignalWire's accepted range 1-${MAX_VALIDITY_SECONDS} — using ${clamped}s.`);
            return clamped;
        }
        return parsed;
    }
    async sendSms(to, body, validitySeconds) {
        if (!this.client) {
            throw new Error('SignalWire is not configured. Set SIGNALWIRE_PROJECT_ID, SIGNALWIRE_API_TOKEN, SIGNALWIRE_SPACE_URL, SIGNALWIRE_FROM_NUMBER in .env');
        }
        const normalizedTo = to.startsWith('+') ? to : `+${to}`;
        const validityPeriod = Math.min(Math.max(Math.trunc(validitySeconds ?? this.validitySeconds), 1), MAX_VALIDITY_SECONDS);
        return new Promise((resolve, reject) => {
            this.client.messages.create({
                from: this.fromNumber,
                to: normalizedTo,
                body,
                validityPeriod,
            })
                .then((message) => resolve(message.sid))
                .catch(reject);
        });
    }
};
exports.SignalwireService = SignalwireService;
exports.SignalwireService = SignalwireService = SignalwireService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], SignalwireService);
//# sourceMappingURL=signalwire.service.js.map