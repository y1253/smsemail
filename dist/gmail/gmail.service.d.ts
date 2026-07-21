import { ConfigService } from '@nestjs/config';
import { gmail_v1 } from 'googleapis';
export declare class GmailService {
    private readonly config;
    constructor(config: ConfigService);
    private getAuthClient;
    watchGmail(refreshToken: string): Promise<{
        historyId: string;
        expiry: Date;
    }>;
    unwatchGmail(refreshToken: string): Promise<void>;
    revokeAccess(refreshToken: string): Promise<void>;
    getNewMessages(refreshToken: string, startHistoryId: string): Promise<gmail_v1.Schema$Message[]>;
    fetchMessage(refreshToken: string, messageId: string): Promise<{
        gmailMessageId: string;
        gmailThreadId: string;
        sender: string;
        subject: string;
        body: string;
        attachmentCount: number;
        labels: string[];
    }>;
    sendReply(refreshToken: string, threadId: string, to: string, subject: string, body: string, from: string): Promise<void>;
    sendEmail(refreshToken: string, from: string, to: string, subject: string, body: string): Promise<void>;
    private extractBody;
    private findPartData;
    private stripQuotedText;
    private buildRaw;
}
