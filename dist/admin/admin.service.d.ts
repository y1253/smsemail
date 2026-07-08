import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { EmailPhoneSet } from '../sets/email-phone-set.entity';
import { Transaction } from '../transactions/transaction.entity';
import { DeletedEmail } from '../emails/deleted-email.entity';
import { DeletedPhone } from '../phones/deleted-phone.entity';
export declare class AdminService {
    private readonly userRepo;
    private readonly setRepo;
    private readonly transactionRepo;
    private readonly deletedEmailRepo;
    private readonly deletedPhoneRepo;
    constructor(userRepo: Repository<User>, setRepo: Repository<EmailPhoneSet>, transactionRepo: Repository<Transaction>, deletedEmailRepo: Repository<DeletedEmail>, deletedPhoneRepo: Repository<DeletedPhone>);
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
        transactions: {
            amount: string;
            createdAt: Date;
        }[];
    }>;
}
