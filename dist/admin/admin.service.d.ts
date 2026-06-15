import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
export declare class AdminService {
    private readonly userRepo;
    constructor(userRepo: Repository<User>);
    getAllAccounts(): Promise<{
        userId: number;
        name: string;
        email: string | null;
        authType: string | null;
        createdAt: Date;
        emails: string[];
        phones: string[];
    }[]>;
}
