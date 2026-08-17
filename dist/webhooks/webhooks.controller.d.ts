import { WebhooksService } from './webhooks.service';
import { WebhookSecurityService } from './webhook-security.service';
export declare class WebhooksController {
    private readonly webhooksService;
    private readonly webhookSecurity;
    private readonly logger;
    constructor(webhooksService: WebhooksService, webhookSecurity: WebhookSecurityService);
    gmailPush(payload: Record<string, any>, authorization: string): Promise<void>;
    signalwireInbound(payload: Record<string, any>, twilioSig: string, signalwireSig: string): Promise<string>;
    stripeWebhook(req: {
        rawBody?: Buffer;
    }, sig: string): Promise<{
        received: boolean;
    }>;
}
