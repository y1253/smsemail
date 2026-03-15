import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { EmailsService } from './emails.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ConnectGoogleEmailDto } from './dto/connect-google-email.dto';

type JwtPayload = {
  user_id: number;
  email: string;
};

@Controller('emails')
export class EmailsController {
  constructor(private readonly emailsService: EmailsService) {}

  @Post('google/connect')
  @UseGuards(AuthGuard)
  async connectGoogleEmail(
    @Body() dto: ConnectGoogleEmailDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.emailsService.connectGoogleEmail(dto, user);
  }
}

