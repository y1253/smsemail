import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { EmailPhoneSet } from '../sets/email-phone-set.entity';
import { DeletedEmail } from '../emails/deleted-email.entity';
import { DeletedPhone } from '../phones/deleted-phone.entity';
import { BillingService, type BillingInvoice } from '../billing/billing.service';
export declare class AdminService {
    private readonly userRepo;
    private readonly setRepo;
    private readonly deletedEmailRepo;
    private readonly deletedPhoneRepo;
    private readonly billingService;
    private readonly logger;
    constructor(userRepo: Repository<User>, setRepo: Repository<EmailPhoneSet>, deletedEmailRepo: Repository<DeletedEmail>, deletedPhoneRepo: Repository<DeletedPhone>, billingService: BillingService);
    getDeletedContacts(): Promise<{
        emails: {
            userId: number;
            value: string;
            originalId: number;
            createdAt: Date;
            deletedAt: Date;
        }[];
        phones: {
            userId: number;
            value: string;
            originalId: number;
            createdAt: Date;
            deletedAt: Date;
        }[];
    }>;
    getAllAccounts(): Promise<{
        userId: number;
        name: string;
        email: string | null;
        authType: string | null;
        createdAt: Date;
        active: number | null;
        setCount: number;
        nextRenewalAt: Date | null;
        pendingCancelAt: Date | null;
        pendingCancelCount: number;
        promoCount: number;
        cancelledCount: number;
        subscriptionsError: string | null;
        emails: string[];
        phones: string[];
    }[]>;
    getAccountDetail(userId: number): Promise<{
        userId: number;
        name: string;
        email: string | null;
        authType: string | null;
        createdAt: Date;
        active: number | null;
        stripeCustomerId: string | null;
        emails: {
            email: string;
            addedAt: Date;
            deletedAt: Date | null;
        }[];
        phones: {
            phone: string;
            addedAt: Date;
            deletedAt: Date | null;
        }[];
        sets: {
            amount: number | null;
            currency: string | null;
            interval: string | null;
            status: "active" | "pending_cancel" | "cancelled";
            renewsAt: Date | null;
            endsAt: Date | null;
            stripeStatus: string | null;
            dbDrift: boolean;
            setId: number;
            createdAt: Date;
            deletedAt: Date | null;
            stripeSubscriptionId: string | null;
            pendingCancelAt: Date | null;
            email: string;
            phone: string;
            promo: boolean;
        }[];
        setCounts: {
            total: number;
            active: number;
        };
        nextRenewalAt: Date | null;
        transactions: BillingInvoice[];
        transactionsError: string | null;
        subscriptionsError: string | null;
    }>;
    private loadTransactions;
}
