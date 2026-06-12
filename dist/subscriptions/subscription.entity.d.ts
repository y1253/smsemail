import { User } from '../users/user.entity';
export declare class Subscription {
    subscriptionId: number;
    user: User;
    activateAt: Date;
    deactivateAt: Date | null;
}
