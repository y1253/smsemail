import { Repository } from 'typeorm';
import { Email } from './email.entity';
import { User } from '../users/user.entity';
import { ConnectGoogleEmailDto } from './dto/connect-google-email.dto';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { GmailService } from '../gmail/gmail.service';
type JwtPayload = {
    user_id: number;
    email: string;
};
export declare class EmailsService {
    private readonly emailRepo;
    private readonly userRepo;
    private readonly config;
    private readonly googleClient;
    private readonly gmailService;
    private readonly encryptionKey;
    constructor(emailRepo: Repository<Email>, userRepo: Repository<User>, config: ConfigService, googleClient: OAuth2Client, gmailService: GmailService);
    connectGoogleEmail(dto: ConnectGoogleEmailDto, user: JwtPayload): Promise<{
        emailId: number;
        email: string;
    }>;
    listEmailsForUser(userId: number): Promise<{
        emailId: number;
        email: string;
        addedAt: Date;
    }[]>;
    decrypt(encrypted: string): string;
    private encrypt;
}
export {};
