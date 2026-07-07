import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Phone } from './phone.entity';
import { PhoneVerification } from './phone-verification.entity';
import { SignalwireService } from '../signalwire/signalwire.service';
export declare class PhonesService {
    private readonly userRepo;
    private readonly phoneRepo;
    private readonly verificationRepo;
    private readonly signalwireService;
    constructor(userRepo: Repository<User>, phoneRepo: Repository<Phone>, verificationRepo: Repository<PhoneVerification>, signalwireService: SignalwireService);
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
