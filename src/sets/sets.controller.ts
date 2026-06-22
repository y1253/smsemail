import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { SetsService } from './sets.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateSetDto } from './dto/create-set.dto';
import { UpdateSendersDto } from './dto/update-senders.dto';

type JwtPayload = {
  user_id: number;
  email: string;
};

@Controller('sets')
export class SetsController {
  constructor(private readonly setsService: SetsService) {}

  @Get()
  @UseGuards(AuthGuard)
  async listSets(@CurrentUser() user: JwtPayload) {
    return this.setsService.listSetsForUser(user.user_id);
  }

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
      dto.promoCode,
    );
  }

  @Delete(':setId')
  @UseGuards(AuthGuard)
  async deleteSet(
    @Param('setId', ParseIntPipe) setId: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.setsService.deleteSetForUser(user.user_id, setId);
  }

  @Put(':setId/senders')
  @UseGuards(AuthGuard)
  async updateSenders(
    @Param('setId', ParseIntPipe) setId: number,
    @Body() dto: UpdateSendersDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.setsService.updateSenders(user.user_id, setId, dto.senders);
  }
}

