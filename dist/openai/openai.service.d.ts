import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export declare class OpenAiService implements OnModuleInit {
    private readonly config;
    private client;
    constructor(config: ConfigService);
    onModuleInit(): void;
    summarize(body: string, budget: number): Promise<string>;
}
