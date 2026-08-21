import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
export declare class AuthService {
    private readonly jwtService;
    private readonly userRepo;
    constructor(jwtService: JwtService, userRepo: Repository<User>);
    validCustomer(request: any): Promise<boolean>;
}
