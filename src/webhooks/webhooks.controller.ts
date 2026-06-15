import {
  BadRequestException,
  Body,
  Controller,
  Header,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('gmail')
  @HttpCode(204)
  async gmailPush(@Body() payload: Record<string, any>): Promise<void> {
    await this.webhooksService.handleGmailPush(payload);
  }

  @Post('signalwire')
  @HttpCode(200)
  @Header('Content-Type', 'text/xml')
  async signalwireInbound(@Body() payload: Record<string, any>): Promise<string> {
    this.logger.debug(`SignalWire inbound payload: ${JSON.stringify(payload)}`);
    // Accept both TwiML-style (From/Body) and SWML-style (from/body) field names
    const from: string = payload['From'] ?? payload['from'] ?? '';
    const body: string = payload['Body'] ?? payload['body'] ?? '';
    if (from && body !== undefined) {
      await this.webhooksService.handleInboundSms(from, body);
    } else {
      this.logger.warn(`SignalWire webhook missing from/body — raw payload: ${JSON.stringify(payload)}`);
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
