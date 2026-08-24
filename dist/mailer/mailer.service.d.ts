import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export interface MailOptions {
    to: string;
    subject: string;
    html: string;
    text: string;
}
export declare class MailerService implements OnModuleInit {
    private readonly config;
    private readonly logger;
    private readonly transport;
    private readonly from;
    constructor(config: ConfigService);
    onModuleInit(): void;
    sendMail({ to, subject, html, text }: MailOptions): Promise<void>;
}
