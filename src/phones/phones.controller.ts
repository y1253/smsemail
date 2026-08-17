import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { PhonesService } from './phones.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RateLimit } from '../common/rate-limit.guard';
import { AddPhoneDto } from './dto/add-phone.dto';
import { VerifyPhoneDto } from './dto/verify-phone.dto';
import { DeletePhoneDto } from './dto/delete-phone.dto';

type JwtPayload = {
  user_id: number;
  email: string;
};

@Controller('phones')
export class PhonesController {
  constructor(private readonly phonesService: PhonesService) {}

  @Get()
  @UseGuards(AuthGuard)
  async listPhones(@CurrentUser() user: JwtPayload) {
    return this.phonesService.listPhonesForUser(user.user_id);
  }

  // Limit SMS sends per client to curb toll fraud / SMS bombing (each send bills
  // the SignalWire account).
  @Post()
  @UseGuards(AuthGuard)
  @RateLimit({ limit: 5, windowMs: 60_000 })
  async sendCode(
    @Body() dto: AddPhoneDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.phonesService.sendVerificationCode(user.user_id, dto.phone, dto.consent);
  }

  // Limit code-guessing attempts (anti-brute-force on the 6-digit code).
  @Post('verify')
  @UseGuards(AuthGuard)
  @RateLimit({ limit: 5, windowMs: 60_000 })
  async verify(
    @Body() dto: VerifyPhoneDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.phonesService.verifyCode(user.user_id, dto.phone, dto.code);
  }

  @Delete('delete')
  @UseGuards(AuthGuard)
  async deletePhone(
    @Body() dto: DeletePhoneDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.phonesService.deletePhoneForUser(user.user_id, dto.phoneId);
  }
}
