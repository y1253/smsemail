import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { GoogleCredentialDto } from './dto/google-credential.dto';
type JwtPayload = {
    user_id: number;
    email: string;
};
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getProfile(user: JwtPayload): Promise<import("./user.entity").User>;
    postUser(newUser: CreateUserDto): Promise<string>;
    login(user: LoginUserDto): Promise<string>;
    postGoogleUser(body: GoogleCredentialDto): Promise<{
        accessToken: string;
    }>;
}
export {};
