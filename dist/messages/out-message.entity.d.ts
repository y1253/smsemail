import { Email } from '../emails/email.entity';
export declare class OutMessage {
    outMessageId: number;
    email: Email;
    sentTo: string;
    createdAt: Date;
}
