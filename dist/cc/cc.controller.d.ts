import { CcService } from './cc.service';
import { AttachPaymentMethodDto } from './dto/attach-payment-method.dto';
import { DeleteCcDto } from './dto/delete-cc.dto';
type JwtPayload = {
    user_id: number;
    email: string;
};
export declare class CcController {
    private readonly ccService;
    constructor(ccService: CcService);
    attachPaymentMethod(dto: AttachPaymentMethodDto, user: JwtPayload): Promise<{
        stripeCustomerId: string;
    }>;
    listPaymentMethods(user: JwtPayload): Promise<{
        id: string;
        brand: string;
        last4: string;
        expMonth: number;
        expYear: number;
    }[]>;
    deletePaymentMethod(dto: DeleteCcDto, user: JwtPayload): Promise<{
        deleted: string;
    }>;
}
export {};
