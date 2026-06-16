import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
export declare class CcService {
    private readonly userRepo;
    private readonly config;
    private stripe;
    private readonly logger;
    constructor(userRepo: Repository<User>, config: ConfigService);
    attachPaymentMethodForUser(userId: number, paymentMethodId: string): Promise<{
        stripeCustomerId: string;
    }>;
    listPaymentMethodsForUser(userId: number): Promise<{
        id: string;
        brand: string;
        last4: string;
        expMonth: number;
        expYear: number;
    }[]>;
    deletePaymentMethodForUser(userId: number, paymentMethodId: string): Promise<{
        deleted: string;
    }>;
}
