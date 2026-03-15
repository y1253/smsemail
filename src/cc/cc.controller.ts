import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { CcService } from './cc.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AttachPaymentMethodDto } from './dto/attach-payment-method.dto';
import { DeleteCcDto } from './dto/delete-cc.dto';

type JwtPayload = {
  user_id: number;
  email: string;
};

@Controller('cc')
export class CcController {
  constructor(private readonly ccService: CcService) {}

  @Post()
  @UseGuards(AuthGuard)
  async attachPaymentMethod(
    @Body() dto: AttachPaymentMethodDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ccService.attachPaymentMethodForUser(
      user.user_id,
      dto.paymentMethodId,
    );
  }

  @Get()
  @UseGuards(AuthGuard)
  async listPaymentMethods(@CurrentUser() user: JwtPayload) {
    return this.ccService.listPaymentMethodsForUser(user.user_id);
  }

  @Delete()
  @UseGuards(AuthGuard)
  async deletePaymentMethod(
    @Body() dto: DeleteCcDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ccService.deletePaymentMethodForUser(
      user.user_id,
      dto.cc_id,
    );
  }
}
