import { EmailsService } from './emails.service';
import { ConnectGoogleEmailDto } from './dto/connect-google-email.dto';
import { DeleteEmailDto } from './dto/delete-email.dto';
type JwtPayload = {
    user_id: number;
    email: string;
};
export declare class EmailsController {
    private readonly emailsService;
    constructor(emailsService: EmailsService);
    listEmails(user: JwtPayload): Promise<{
        emailId: number;
        email: string;
        addedAt: Date;
    }[]>;
    connectGoogleEmail(dto: ConnectGoogleEmailDto, user: JwtPayload): Promise<{
        emailId: number;
        email: string;
    }>;
    deleteEmail(dto: DeleteEmailDto, user: JwtPayload): Promise<{
        deleted: true;
        emailId: number;
    }>;
}
export {};
