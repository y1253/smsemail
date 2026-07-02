import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { EmailPhoneSet } from '../sets/email-phone-set.entity';
import { Transaction } from '../transactions/transaction.entity';
export declare class AdminService {
    private readonly userRepo;
    private readonly setRepo;
    private readonly transactionRepo;
    constructor(userRepo: Repository<User>, setRepo: Repository<EmailPhoneSet>, transactionRepo: Repository<Transaction>);
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
