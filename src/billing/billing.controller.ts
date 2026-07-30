import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { BillingService } from './billing.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ListInvoicesDto } from './dto/list-invoices.dto';

type JwtPayload = {
  user_id: number;
  email: string;
};

/**
 * Deliberately mounted under `/cc`, not `/billing`. nginx only proxies
 * `^/(users|emails|phones|sets|cc|webhooks|trypayment)` to this server
 * (see server/nginx/ygbackend.com) — anything else falls through to the SPA and
 * returns index.html with a 200. Do not "fix" this prefix without updating nginx.
 */
@Controller('cc')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('invoices')
  @UseGuards(AuthGuard)
  async listInvoices(
    @Query() dto: ListInvoicesDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.billingService.listInvoicesForUser(user.user_id, dto);
  }

  @Get('subscriptions')
  @UseGuards(AuthGuard)
  async listSubscriptions(@CurrentUser() user: JwtPayload) {
    return this.billingService.listSubscriptionsForUser(user.user_id);
  }
}
