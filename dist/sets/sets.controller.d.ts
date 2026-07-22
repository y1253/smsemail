import { SetsService } from './sets.service';
import { CreateSetDto } from './dto/create-set.dto';
import { UpdateSendersDto } from './dto/update-senders.dto';
type JwtPayload = {
    user_id: number;
    email: string;
};
export declare class SetsController {
    private readonly setsService;
    constructor(setsService: SetsService);
    listSets(user: JwtPayload): Promise<{
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
    validatePromo(code: string): {
        valid: boolean;
    };
    createSet(dto: CreateSetDto, user: JwtPayload): Promise<{
        setId: number;
    }>;
    deleteSet(setId: number, user: JwtPayload): Promise<{
        deleted: true;
    }>;
    updateSenders(setId: number, dto: UpdateSendersDto, user: JwtPayload): Promise<{
        updated: true;
    }>;
    cancelSubscription(setId: number, user: JwtPayload): Promise<{
        cancelAt: Date;
    }>;
}
export {};
