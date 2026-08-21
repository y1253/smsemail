import { User } from './user.entity';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { MailerService } from '../mailer/mailer.service';
export declare class UsersService {
    private readonly userRepo;
    private readonly jwtService;
    private readonly googleClient;
    private readonly mailer;
    private readonly logger;
    constructor(userRepo: Repository<User>, jwtService: JwtService, googleClient: OAuth2Client, mailer: MailerService);
    getProfile(userId: number): Promise<User>;
    updateProfile(userId: number, dto: UpdateProfileDto): Promise<User>;
    changePassword(userId: number, dto: ChangePasswordDto): Promise<{
        ok: boolean;
    }>;
    forgotPassword(email: string): Promise<{
        ok: true;
    }>;
    private trySend;
    private static generateTempPassword;
    createNewUser(newUser: any): Promise<string>;
    private static readonly DUMMY_HASH;
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
