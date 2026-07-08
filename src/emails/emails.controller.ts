import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { EmailsService } from './emails.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ConnectGoogleEmailDto } from './dto/connect-google-email.dto';
import { DeleteEmailDto } from './dto/delete-email.dto';

type JwtPayload = {
  user_id: number;
  email: string;
};

@Controller('emails')
export class EmailsController {
  constructor(private readonly emailsService: EmailsService) {}

  @Get()
  @UseGuards(AuthGuard)
  async listEmails(@CurrentUser() user: JwtPayload) {
    return this.emailsService.listEmailsForUser(user.user_id);
  }

  @Post('google/connect')
  @UseGuards(AuthGuard)
  async connectGoogleEmail(
    @Body() dto: ConnectGoogleEmailDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.emailsService.connectGoogleEmail(dto, user);
  }

  @Delete('delete')
  @UseGuards(AuthGuard)
  async deleteEmail(
    @Body() dto: DeleteEmailDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.emailsService.deleteEmailForUser(user.user_id, dto.emailId);
  }
}

