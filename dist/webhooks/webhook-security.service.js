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
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var WebhookSecurityService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookSecurityService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const google_auth_library_1 = require("google-auth-library");
const crypto = __importStar(require("crypto"));
let WebhookSecurityService = WebhookSecurityService_1 = class WebhookSecurityService {
    config;
    logger = new common_1.Logger(WebhookSecurityService_1.name);
    oauthClient = new google_auth_library_1.OAuth2Client();
    constructor(config) {
        this.config = config;
    }
    async verifyGmailPush(authHeader) {
        const expectedEmail = this.config.get('GOOGLE_PUBSUB_SA_EMAIL');
        if (!expectedEmail) {
            this.logger.warn('GOOGLE_PUBSUB_SA_EMAIL not set — Gmail push authentication is DISABLED (temporary). ' +
                'Enable OIDC on the Pub/Sub subscription and set this env var before submitting for CASA.');
            return;
        }
        const token = (authHeader ?? '').replace(/^Bearer\s+/i, '').trim();
        if (!token)
            throw new common_1.UnauthorizedException('Missing Pub/Sub bearer token');
        const audience = this.config.get('GOOGLE_PUBSUB_AUDIENCE') ??
            `${this.publicBase()}/webhooks/gmail`;
        let payload;
        try {
            const ticket = await this.oauthClient.verifyIdToken({ idToken: token, audience });
            payload = ticket.getPayload();
        }
        catch (err) {
            this.logger.warn(`Gmail push token verification failed: ${err}`);
            throw new common_1.UnauthorizedException('Invalid Pub/Sub token');
        }
        const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
        if (!payload || !validIssuers.includes(payload.iss ?? '')) {
            throw new common_1.UnauthorizedException('Invalid Pub/Sub token issuer');
        }
        if (payload.email !== expectedEmail || payload.email_verified !== true) {
            throw new common_1.UnauthorizedException('Pub/Sub token not from the expected service account');
        }
    }
    verifySignalwire(signature, params) {
        if (this.config.get('SIGNALWIRE_VERIFY_SIGNATURE') === 'false') {
            this.logger.warn('SignalWire signature verification DISABLED via SIGNALWIRE_VERIFY_SIGNATURE=false — re-enable before submitting for CASA.');
            return;
        }
        const authToken = this.config.get('SIGNALWIRE_API_TOKEN');
        if (!authToken) {
            this.logger.error('SIGNALWIRE_API_TOKEN is not set — cannot verify inbound SMS signature');
            throw new common_1.UnauthorizedException('SignalWire webhook authentication not configured');
        }
        if (!signature)
            throw new common_1.UnauthorizedException('Missing SignalWire signature');
        const url = this.config.get('SIGNALWIRE_WEBHOOK_URL') ??
            `${this.publicBase()}/webhooks/signalwire`;
        const data = url +
            Object.keys(params ?? {})
                .filter((k) => typeof params[k] !== 'object')
                .sort()
                .map((k) => k + String(params[k]))
                .join('');
        const expected = crypto.createHmac('sha1', authToken).update(data, 'utf8').digest('base64');
        const a = Buffer.from(expected);
        const b = Buffer.from(signature);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
            throw new common_1.UnauthorizedException('Invalid SignalWire signature');
        }
    }
    publicBase() {
        return (this.config.get('PUBLIC_URL') ?? '').replace(/\/+$/, '');
    }
};
exports.WebhookSecurityService = WebhookSecurityService;
exports.WebhookSecurityService = WebhookSecurityService = WebhookSecurityService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], WebhookSecurityService);
//# sourceMappingURL=webhook-security.service.js.map