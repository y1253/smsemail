import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { SetsService } from './sets.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateSetDto } from './dto/create-set.dto';

type JwtPayload = {
  user_id: number;
  email: string;
};

@Controller('sets')
export class SetsController {
  constructor(private readonly setsService: SetsService) {}

  @Post()
  @UseGuards(AuthGuard)
  async createSet(
    @Body() dto: CreateSetDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.setsService.createSetForUser(
      user.user_id,
      dto.emailId,
      dto.phoneId,
    );
  }
}

