import { Repository } from 'typeorm';
import { Email } from './email.entity';
import { DeletedEmail } from './deleted-email.entity';
import { User } from '../users/user.entity';
import { ConnectGoogleEmailDto } from './dto/connect-google-email.dto';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { GmailService } from '../gmail/gmail.service';
import { SetsService } from '../sets/sets.service';
type JwtPayload = {
    user_id: number;
    email: string;
};
export declare class EmailsService {
    private readonly emailRepo;
    private readonly deletedEmailRepo;
    private readonly userRepo;
    private readonly config;
    private readonly googleClient;
    private readonly gmailService;
    private readonly setsService;
    private readonly encryptionKey;
    private readonly logger;
    constructor(emailRepo: Repository<Email>, deletedEmailRepo: Repository<DeletedEmail>, userRepo: Repository<User>, config: ConfigService, googleClient: OAuth2Client, gmailService: GmailService, setsService: SetsService);
    connectGoogleEmail(dto: ConnectGoogleEmailDto, user: JwtPayload): Promise<{
        emailId: number;
        email: string;
    }>;
    listEmailsForUser(userId: number): Promise<{
        emailId: number;
        email: string;
        addedAt: Date;
    }[]>;
    deleteEmailForUser(userId: number, emailId: number): Promise<{
        deleted: true;
        emailId: number;
    }>;
    decrypt(encrypted: string): string;
    private encrypt;
}
export {};
