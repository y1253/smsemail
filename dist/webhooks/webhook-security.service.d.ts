import { ConfigService } from '@nestjs/config';
export declare class WebhookSecurityService {
    private readonly config;
    private readonly logger;
    private readonly oauthClient;
    constructor(config: ConfigService);
    verifyGmailPush(authHeader: string | undefined): Promise<void>;
    verifySignalwire(signature: string | undefined, params: Record<string, any>): void;
    private publicBase;
}
