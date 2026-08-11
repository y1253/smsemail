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
  gmailPush(@Body() payload: Record<string, any>): void {
    // Ack first, work after. The pipeline (Gmail fetch + OpenAI summary + SMS)
    // routinely outruns Pub/Sub's ack deadline, and Pub/Sub answers a late ack
    // by redelivering the identical notification — which used to replay the
    // whole thing and text the user twice. Dropping Pub/Sub's retry is safe:
    // handleGmailPush already isolates per-message failures, and lastHistoryId
    // only advances past messages that were actually handled, so a genuinely
    // lost notification is picked up by the next push.
    void this.webhooksService
      .handleGmailPush(payload)
      .catch((err) => this.logger.error(`Gmail push handling failed: ${err}`));
  }

  @Post('signalwire')
  @HttpCode(200)
  @Header('Content-Type', 'text/xml')
  async signalwireInbound(@Body() payload: Record<string, any>): Promise<string> {
    this.logger.debug(`SignalWire inbound payload: ${JSON.stringify(payload)}`);
    // TwiML: top-level From/Body; SWML: nested under payload.message.from/body
    const msg = payload['message'] ?? {};
    const from: string = payload['From'] ?? payload['from'] ?? msg['from'] ?? '';
    const body: string = payload['Body'] ?? payload['body'] ?? msg['body'] ?? '';
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
