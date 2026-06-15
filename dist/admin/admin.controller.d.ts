import { ConfigService } from '@nestjs/config';
import { AdminService } from './admin.service';
export declare class AdminController {
    private readonly adminService;
    private readonly config;
    constructor(adminService: AdminService, config: ConfigService);
    getAccounts(password: string): Promise<{
        userId: number;
        name: string;
        email: string | null;
        authType: string | null;
        createdAt: Date;
        emails: string[];
        phones: string[];
    }[]>;
}
