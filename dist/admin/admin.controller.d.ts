import { ConfigService } from '@nestjs/config';
import { AdminService } from './admin.service';
export declare class AdminController {
    private readonly adminService;
    private readonly config;
    constructor(adminService: AdminService, config: ConfigService);
    private assertAdmin;
    getAccounts(password: string): Promise<{
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
    getDeleted(password: string): Promise<{
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
    getAccount(password: string, userId: number): Promise<{
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
