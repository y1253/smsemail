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
            setId: number;
            createdAt: Date;
            deletedAt: Date | null;
            stripeSubscriptionId: string | null;
            pendingCancelAt: Date | null;
            email: string;
            phone: string;
            promo: boolean;
            status: string;
        }[];
        setCounts: {
            total: number;
            active: number;
        };
        transactions: BillingInvoice[];
        transactionsError: string | null;
    }>;
    private loadTransactions;
}
