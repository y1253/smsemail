import { PhonesService } from './phones.service';
import { AddPhoneDto } from './dto/add-phone.dto';
import { VerifyPhoneDto } from './dto/verify-phone.dto';
import { DeletePhoneDto } from './dto/delete-phone.dto';
type JwtPayload = {
    user_id: number;
    email: string;
};
export declare class PhonesController {
    private readonly phonesService;
    constructor(phonesService: PhonesService);
    listPhones(user: JwtPayload): Promise<{
        phoneId: number;
        phone: string;
        addedAt: Date;
    }[]>;
    sendCode(dto: AddPhoneDto, user: JwtPayload): Promise<{
        sent: boolean;
    }>;
    verify(dto: VerifyPhoneDto, user: JwtPayload): Promise<{
        verified: true;
        phoneId: number;
    }>;
    deletePhone(dto: DeletePhoneDto, user: JwtPayload): Promise<{
        deleted: true;
        phoneId: number;
    }>;
}
export {};
