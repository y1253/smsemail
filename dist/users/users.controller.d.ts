import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { GoogleCredentialDto } from './dto/google-credential.dto';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    postUser(newUser: CreateUserDto): Promise<string>;
    login(user: LoginUserDto): Promise<string>;
    postGoogleUser(body: GoogleCredentialDto): Promise<{
        accessToken: string;
    }>;
}
