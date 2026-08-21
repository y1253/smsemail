import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { GoogleCredentialDto } from './dto/google-credential.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
type JwtPayload = {
    user_id: number;
    email: string;
};
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getProfile(user: JwtPayload): Promise<import("./user.entity").User>;
    updateProfile(user: JwtPayload, body: UpdateProfileDto): Promise<import("./user.entity").User>;
    changePassword(user: JwtPayload, body: ChangePasswordDto): Promise<{
        ok: true;
        token: string;
    }>;
    postUser(newUser: CreateUserDto): Promise<string>;
    login(user: LoginUserDto): Promise<string>;
    forgotPassword(body: ForgotPasswordDto): Promise<{
        ok: true;
    }>;
    postGoogleUser(body: GoogleCredentialDto): Promise<{
        accessToken: string;
    }>;
}
export {};
