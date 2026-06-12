import { WebhooksService } from './webhooks.service';
export declare class WebhooksController {
    private readonly webhooksService;
    constructor(webhooksService: WebhooksService);
    gmailPush(payload: Record<string, any>): Promise<void>;
    signalwireInbound(from: string, body: string): Promise<string>;
    stripeWebhook(req: {
        rawBody?: Buffer;
    }, sig: string): Promise<{
        received: boolean;
    }>;
}
