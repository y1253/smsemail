import { Email } from '../emails/email.entity';
import { Phone } from '../phones/phone.entity';
import { Transaction } from '../transactions/transaction.entity';
import { Subscription } from '../subscriptions/subscription.entity';
export declare class User {
    userId: number;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    password: string | null;
    authType: string | null;
    createdAt: Date;
    stripeCustomerId: string | null;
    active: number | null;
    emails: Email[];
    phones: Phone[];
    transactions: Transaction[];
    subscriptions: Subscription[];
}
