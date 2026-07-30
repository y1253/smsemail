import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { EmailPhoneSet } from '../sets/email-phone-set.entity';
import { ListInvoicesDto } from './dto/list-invoices.dto';
export type BillingInvoice = {
    id: string;
    number: string | null;
    status: string;
    amount: number;
    currency: string;
    created: Date;
    paidAt: Date | null;
    description: string | null;
    subscriptionId: string | null;
    hostedInvoiceUrl: string | null;
    invoicePdf: string | null;
};
export type InvoicePage = {
    data: BillingInvoice[];
    hasMore: boolean;
    nextCursor: string | null;
};
export type BillingSubscription = {
    setId: number;
    email: string;
    phone: string;
    createdAt: Date;
    status: 'active' | 'pending_cancel';
    promo: boolean;
    stripeSubscriptionId: string | null;
    pendingCancelAt: Date | null;
    currentPeriodEnd: Date | null;
    stripeStatus: string | null;
    amount: number | null;
    currency: string | null;
    interval: string | null;
};
export declare class BillingService {
    private readonly userRepo;
    private readonly setRepo;
    private readonly config;
    private readonly stripe;
    private readonly logger;
    constructor(userRepo: Repository<User>, setRepo: Repository<EmailPhoneSet>, config: ConfigService);
    listInvoicesForUser(userId: number, dto: ListInvoicesDto): Promise<InvoicePage>;
    private toBillingInvoice;
    private resolveInvoiceSubscriptionId;
    listSubscriptionsForUser(userId: number): Promise<BillingSubscription[]>;
    private loadStripeSubscriptions;
    private resolvePeriodEnd;
}
