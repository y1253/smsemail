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
        nextRenewalAt: Date | null;
        pendingCancelAt: Date | null;
        pendingCancelCount: number;
        promoCount: number;
        subscriptionsError: string | null;
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
        transactions: import("../billing/billing.service").BillingInvoice[];
        transactionsError: string | null;
        subscriptionsError: string | null;
    }>;
}
