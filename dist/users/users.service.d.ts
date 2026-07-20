import { User } from './user.entity';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
export declare class UsersService {
    private readonly userRepo;
    private readonly jwtService;
    private readonly googleClient;
    constructor(userRepo: Repository<User>, jwtService: JwtService, googleClient: OAuth2Client);
    getProfile(userId: number): Promise<User>;
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
