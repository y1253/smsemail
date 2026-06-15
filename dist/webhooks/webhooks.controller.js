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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var WebhooksController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhooksController = void 0;
const common_1 = require("@nestjs/common");
const webhooks_service_1 = require("./webhooks.service");
let WebhooksController = WebhooksController_1 = class WebhooksController {
    webhooksService;
    logger = new common_1.Logger(WebhooksController_1.name);
    constructor(webhooksService) {
        this.webhooksService = webhooksService;
    }
    async gmailPush(payload) {
        await this.webhooksService.handleGmailPush(payload);
    }
    async signalwireInbound(payload) {
        this.logger.debug(`SignalWire inbound payload: ${JSON.stringify(payload)}`);
        const msg = payload['message'] ?? {};
        const from = payload['From'] ?? payload['from'] ?? msg['from'] ?? '';
        const body = payload['Body'] ?? payload['body'] ?? msg['body'] ?? '';
        if (from && body !== undefined) {
            await this.webhooksService.handleInboundSms(from, body);
        }
        else {
            this.logger.warn(`SignalWire webhook missing from/body — raw payload: ${JSON.stringify(payload)}`);
        }
        return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
    }
    async stripeWebhook(req, sig) {
        if (!req.rawBody)
            throw new common_1.BadRequestException('Missing raw body');
        await this.webhooksService.handleStripeWebhook(req.rawBody, sig);
        return { received: true };
    }
};
exports.WebhooksController = WebhooksController;
__decorate([
    (0, common_1.Post)('gmail'),
    (0, common_1.HttpCode)(204),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WebhooksController.prototype, "gmailPush", null);
__decorate([
    (0, common_1.Post)('signalwire'),
    (0, common_1.HttpCode)(200),
    (0, common_1.Header)('Content-Type', 'text/xml'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WebhooksController.prototype, "signalwireInbound", null);
__decorate([
    (0, common_1.Post)('stripe'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)('stripe-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], WebhooksController.prototype, "stripeWebhook", null);
exports.WebhooksController = WebhooksController = WebhooksController_1 = __decorate([
    (0, common_1.Controller)('webhooks'),
    __metadata("design:paramtypes", [webhooks_service_1.WebhooksService])
], WebhooksController);
//# sourceMappingURL=webhooks.controller.js.map