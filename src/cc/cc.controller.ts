import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CcService } from './cc.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

type JwtPayload = {
  user_id: number;
  email: string;
};

@Controller('cc')
export class CcController {
  constructor(private readonly ccService: CcService) {}

  @Post()
  @UseGuards(AuthGuard)
  async createCc(
    @Body('cc') cc: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const userId = user.user_id;
    return this.ccService.createForUser(userId, cc);
  }
}

