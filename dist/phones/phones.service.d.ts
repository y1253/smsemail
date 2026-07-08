import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Phone } from './phone.entity';
import { DeletedPhone } from './deleted-phone.entity';
import { PhoneVerification } from './phone-verification.entity';
import { SignalwireService } from '../signalwire/signalwire.service';
import { SetsService } from '../sets/sets.service';
export declare class PhonesService {
    private readonly userRepo;
    private readonly phoneRepo;
    private readonly deletedPhoneRepo;
    private readonly verificationRepo;
    private readonly signalwireService;
    private readonly setsService;
    constructor(userRepo: Repository<User>, phoneRepo: Repository<Phone>, deletedPhoneRepo: Repository<DeletedPhone>, verificationRepo: Repository<PhoneVerification>, signalwireService: SignalwireService, setsService: SetsService);
    listPhonesForUser(userId: number): Promise<{
        phoneId: number;
        phone: string;
        addedAt: Date;
    }[]>;
    sendVerificationCode(userId: number, phone: string, consent: boolean): Promise<{
        sent: boolean;
    }>;
    verifyCode(userId: number, phone: string, code: string): Promise<{
        verified: true;
        phoneId: number;
    }>;
    deletePhoneForUser(userId: number, phoneId: number): Promise<{
        deleted: true;
        phoneId: number;
    }>;
    private generateCode;
}
