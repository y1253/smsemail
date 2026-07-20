import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { GoogleCredentialDto } from './dto/google-credential.dto';

type JwtPayload = {
  user_id: number;
  email: string;
};

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @UseGuards(AuthGuard)
  async getProfile(@CurrentUser() user: JwtPayload) {
    return this.usersService.getProfile(user.user_id);
  }

  @Post('create')
  async postUser(@Body() newUser: CreateUserDto) {
    return await this.usersService.createNewUser(newUser);
  }

  @Post('login')
  async login(@Body() user: LoginUserDto) {
    return await this.usersService.login(user);
  }

  @Post('google')
  async postGoogleUser(@Body() body: GoogleCredentialDto) {
    return this.usersService.googleLogin(body.credential);
  }
}
