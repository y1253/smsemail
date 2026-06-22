import { Email } from '../emails/email.entity';
import { Phone } from '../phones/phone.entity';
import { SetAllowedSender } from './set-allowed-sender.entity';
export declare class EmailPhoneSet {
    setId: number;
    email: Email;
    phone: Phone;
    createdAt: Date;
    deletedAt: Date | null;
    stripeSubscriptionId: string | null;
    allowedSenders: SetAllowedSender[];
}
