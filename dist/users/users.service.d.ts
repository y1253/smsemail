import { User } from './user.entity';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
export declare class UsersService {
    private readonly userRepo;
    private readonly jwtService;
    private readonly googleClient;
    constructor(userRepo: Repository<User>, jwtService: JwtService, googleClient: OAuth2Client);
    getUser({ user_id }: {
        user_id: number;
    }): Promise<{
        userId?: number | undefined;
        firstName?: string | null | undefined;
        lastName?: string | null | undefined;
        email?: string | null | undefined;
        password?: string | undefined;
        authType?: string | null | undefined;
        createdAt?: Date | undefined;
        stripeCustomerId?: string | null | undefined;
        active?: number | null | undefined;
        emails?: import("../emails/email.entity").Email[] | undefined;
        phones?: import("../phones/phone.entity").Phone[] | undefined;
        transactions?: import("../transactions/transaction.entity").Transaction[] | undefined;
        subscriptions?: import("../subscriptions/subscription.entity").Subscription[] | undefined;
    }>;
    createNewUser(newUser: any): Promise<string>;
    login(user: {
        email: string;
        password: string;
    }): Promise<string>;
    googleLogin(credential: string): Promise<{
        accessToken: string;
    }>;
    private getUserByEmail;
    private createToken;
    private hashPassword;
}
