import { WebhooksService } from './webhooks.service';
export declare class WebhooksController {
    private readonly webhooksService;
    private readonly logger;
    constructor(webhooksService: WebhooksService);
    gmailPush(payload: Record<string, any>): void;
    signalwireInbound(payload: Record<string, any>): Promise<string>;
    stripeWebhook(req: {
        rawBody?: Buffer;
    }, sig: string): Promise<{
        received: boolean;
    }>;
}
