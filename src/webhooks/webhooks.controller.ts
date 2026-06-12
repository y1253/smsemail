import {
  BadRequestException,
  Body,
  Controller,
  Header,
  Headers,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('gmail')
  @HttpCode(204)
  async gmailPush(@Body() payload: Record<string, any>): Promise<void> {
    await this.webhooksService.handleGmailPush(payload);
  }

  @Post('signalwire')
  @HttpCode(200)
  @Header('Content-Type', 'text/xml')
  async signalwireInbound(
    @Body('From') from: string,
    @Body('Body') body: string,
  ): Promise<string> {
    if (from && body !== undefined) {
      await this.webhooksService.handleInboundSms(from, body);
    }
    return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
  }

  @Post('stripe')
  @HttpCode(200)
  async stripeWebhook(
    @Req() req: { rawBody?: Buffer },
    @Headers('stripe-signature') sig: string,
  ): Promise<{ received: boolean }> {
    if (!req.rawBody) throw new BadRequestException('Missing raw body');
    await this.webhooksService.handleStripeWebhook(req.rawBody, sig);
    return { received: true };
  }
}
