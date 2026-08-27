import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RateLimit } from '../common/rate-limit.guard';
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

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @UseGuards(AuthGuard)
  async getProfile(@CurrentUser() user: JwtPayload) {
    return this.usersService.getProfile(user.user_id);
  }

  @Put('profile')
  @UseGuards(AuthGuard)
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() body: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.user_id, body);
  }

  // Verifying the current password makes this a guessing oracle, so it carries
  // the same limit as /phones/verify — the strictest in the app.
  @Post('password')
  @UseGuards(AuthGuard)
  @RateLimit({ limit: 5, windowMs: 60_000 })
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() body: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(user.user_id, body);
  }

  @Post('create')
  @RateLimit({ limit: 5, windowMs: 60_000 })
  async postUser(@Body() newUser: CreateUserDto) {
    return await this.usersService.createNewUser(newUser);
  }

  @Post('login')
  @RateLimit({ limit: 10, windowMs: 60_000 })
  async login(@Body() user: LoginUserDto) {
    return await this.usersService.login(user);
  }

  // Public by design, and tighter than /login: every accepted call sends real
  // mail and rewrites a password, so a loose limit is both a spam vector and a
  // way to lock someone out by repeatedly resetting them. Since the handler
  // distinguishes an unknown address (404) from a real one, this limit is also
  // the only thing bounding how fast the endpoint can be walked for account
  // enumeration — do not loosen it.
  @Post('forgot-password')
  @RateLimit({ limit: 3, windowMs: 15 * 60_000 })
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.usersService.forgotPassword(body.email);
  }

  @Post('google')
  @RateLimit({ limit: 10, windowMs: 60_000 })
  async postGoogleUser(@Body() body: GoogleCredentialDto) {
    return this.usersService.googleLogin(body.credential);
  }
}
