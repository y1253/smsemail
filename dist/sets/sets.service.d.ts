import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/user.entity';
import { Email } from '../emails/email.entity';
import { Phone } from '../phones/phone.entity';
import { EmailPhoneSet } from './email-phone-set.entity';
import { SetAllowedSender } from './set-allowed-sender.entity';
import { EmailsService } from '../emails/emails.service';
import { GmailService } from '../gmail/gmail.service';
import { SignalwireService } from '../signalwire/signalwire.service';
import { BillingService } from '../billing/billing.service';
export declare class SetsService {
    private readonly userRepo;
    private readonly emailRepo;
    private readonly phoneRepo;
    private readonly setRepo;
    private readonly senderRepo;
    private readonly config;
    private readonly emailsService;
    private readonly gmailService;
    private readonly signalwireService;
    private readonly billing;
    private readonly stripe;
    private readonly logger;
    private static readonly TERMINAL_STRIPE_STATUSES;
    private static readonly CANCELLED_NOTICE;
    constructor(userRepo: Repository<User>, emailRepo: Repository<Email>, phoneRepo: Repository<Phone>, setRepo: Repository<EmailPhoneSet>, senderRepo: Repository<SetAllowedSender>, config: ConfigService, emailsService: EmailsService, gmailService: GmailService, signalwireService: SignalwireService, billing: BillingService);
    listSetsForUser(userId: number): Promise<{
        setId: number;
        createdAt: Date;
        pendingCancelAt: Date | null;
        email: {
            emailId: number;
            email: string;
        };
        phone: {
            phoneId: number;
            phone: string;
        };
        allowedSenders: string[];
        stripeSubscriptionId: string | null;
    }[]>;
    deleteSetForUser(userId: number, setId: number): Promise<{
        deleted: true;
    }>;
    private teardownSet;
    private isLastSetForEmail;
    teardownSetsForEmail(userId: number, emailId: number): Promise<number>;
    teardownSetsForPhone(userId: number, phoneId: number): Promise<number>;
    private isPromoValid;
    validatePromo(promoCode: string): {
        valid: boolean;
    };
    private resolveCancelAt;
    createSetForUser(userId: number, emailId: number, phoneId: number, promoCode?: string): Promise<{
        setId: number;
    }>;
    cancelSetSubscription(userId: number, setId: number): Promise<{
        cancelAt: Date | null;
    }>;
    resumeSetSubscription(userId: number, setId: number): Promise<{
        resumed: true;
        nextBillingAt: Date | null;
    }>;
    reconcileSubscriptions(): Promise<void>;
    private reconcileSet;
    private endSet;
    updateSenders(userId: number, setId: number, senders: string[]): Promise<{
        updated: true;
    }>;
    private refreshGmailWatch;
}
