import { Email } from '../emails/email.entity';
export declare class IncomeMessage {
    messageId: number;
    email: Email;
    createdAt: Date;
    gmailMessageId: string;
    gmailThreadId: string;
    sender: string;
    subject: string;
}
