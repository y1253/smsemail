import { User } from '../users/user.entity';
export declare class Phone {
    phoneId: number;
    user: User;
    phone: string;
    addedAt: Date;
    deletedAt: Date | null;
    consentAt: Date | null;
    optedOutAt: Date | null;
}
