import { ConfigService } from '@nestjs/config';
export declare class SignalwireService {
    private readonly config;
    private readonly logger;
    private readonly client;
    private readonly fromNumber;
    private readonly validitySeconds;
    constructor(config: ConfigService);
    private resolveValiditySeconds;
    sendSms(to: string, body: string, validitySeconds?: number): Promise<string>;
}
