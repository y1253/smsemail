import { SetsService } from './sets.service';
import { CreateSetDto } from './dto/create-set.dto';
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
        email: {
            emailId: number;
            email: string;
        };
        phone: {
            phoneId: number;
            phone: string;
        };
    }[]>;
    createSet(dto: CreateSetDto, user: JwtPayload): Promise<{
        setId: number;
    }>;
    deleteSet(setId: number, user: JwtPayload): Promise<{
        deleted: true;
    }>;
}
export {};
