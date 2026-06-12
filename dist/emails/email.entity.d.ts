import { User } from '../users/user.entity';
import { IncomeMessage } from '../messages/income-message.entity';
import { OutMessage } from '../messages/out-message.entity';
export declare class Email {
    emailId: number;
    user: User;
    email: string;
    refreshToken: string;
    addedAt: Date;
    deletedAt: Date | null;
    lastHistoryId: string | null;
    watchExpiry: Date | null;
    incomeMessages: IncomeMessage[];
    outMessages: OutMessage[];
}
