import { Body, Controller, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { GoogleCredentialDto } from './dto/google-credential.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
