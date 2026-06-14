import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/user.entity';
import { Email } from '../emails/email.entity';
import { Phone } from '../phones/phone.entity';
import { EmailPhoneSet } from './email-phone-set.entity';
import { EmailsService } from '../emails/emails.service';
import { GmailService } from '../gmail/gmail.service';
export declare class SetsService {
    private readonly userRepo;
    private readonly emailRepo;
    private readonly phoneRepo;
    private readonly setRepo;
    private readonly config;
    private readonly emailsService;
    private readonly gmailService;
    private readonly stripe;
    private readonly logger;
    constructor(userRepo: Repository<User>, emailRepo: Repository<Email>, phoneRepo: Repository<Phone>, setRepo: Repository<EmailPhoneSet>, config: ConfigService, emailsService: EmailsService, gmailService: GmailService);
    listSetsForUser(userId: number): Promise<{
        setId: number;
        createdAt: Date;
        email: {
            emailId: number;
            email: string;
        };
        phone: {
            phoneId: number;
            phone: string;
        };
    }[]>;
    deleteSetForUser(userId: number, setId: number): Promise<{
        deleted: true;
    }>;
    createSetForUser(userId: number, emailId: number, phoneId: number, promoCode?: string): Promise<{
        setId: number;
    }>;
    private refreshGmailWatch;
}
