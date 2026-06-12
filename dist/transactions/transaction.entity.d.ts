import { User } from '../users/user.entity';
export declare class Transaction {
    transactionId: number;
    user: User;
    amount: string;
    createdAt: Date;
}
