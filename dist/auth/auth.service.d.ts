import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
export declare const SESSION_INVALID = "SESSION_INVALID";
export type SessionEndReason = 'expired' | 'revoked' | 'invalid';
export declare class AuthService {
    private readonly jwtService;
    private readonly userRepo;
    constructor(jwtService: JwtService, userRepo: Repository<User>);
    validCustomer(request: any): Promise<boolean>;
}
