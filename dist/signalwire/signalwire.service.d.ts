import { ConfigService } from '@nestjs/config';
export declare class SignalwireService {
    private readonly config;
    private readonly client;
    private readonly fromNumber;
    constructor(config: ConfigService);
    sendSms(to: string, body: string): Promise<string>;
}
