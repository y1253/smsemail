import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { PhonesService } from './phones.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AddPhoneDto } from './dto/add-phone.dto';
import { VerifyPhoneDto } from './dto/verify-phone.dto';

type JwtPayload = {
  user_id: number;
  email: string;
};

@Controller('phones')
export class PhonesController {
  constructor(private readonly phonesService: PhonesService) {}

  @Post()
  @UseGuards(AuthGuard)
  async sendCode(
    @Body() dto: AddPhoneDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.phonesService.sendVerificationCode(user.user_id, dto.phone);
  }

  @Post('verify')
  @UseGuards(AuthGuard)
  async verify(
    @Body() dto: VerifyPhoneDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.phonesService.verifyCode(user.user_id, dto.phone, dto.code);
  }
}
