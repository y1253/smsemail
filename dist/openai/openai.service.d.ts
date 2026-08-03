import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export declare class OpenAiService implements OnModuleInit {
    private readonly config;
    private readonly logger;
    private client;
    constructor(config: ConfigService);
    onModuleInit(): void;
    summarize(subject: string, body: string, budget: number): Promise<string>;
    private oneLine;
}
