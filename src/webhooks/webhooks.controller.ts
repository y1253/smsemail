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
import { WebhookSecurityService } from './webhook-security.service';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly webhookSecurity: WebhookSecurityService,
  ) {}

  @Post('gmail')
  @HttpCode(204)
  async gmailPush(
    @Body() payload: Record<string, any>,
    @Headers('authorization') authorization: string,
  ): Promise<void> {
    // Authenticate the Pub/Sub push (Google-signed OIDC bearer) BEFORE doing any
    // work. Fails closed: an unsigned/forged push is rejected with 401.
    await this.webhookSecurity.verifyGmailPush(authorization);
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
  async signalwireInbound(
    @Body() payload: Record<string, any>,
    @Headers('x-twilio-signature') twilioSig: string,
    @Headers('x-signalwire-signature') signalwireSig: string,
    @Headers('content-type') contentType: string,
  ): Promise<string> {
    // TEMP DIAGNOSTIC (remove after fixing signature verification): logs the
    // request shape only (no PII values) to determine SignalWire's signing method.
    this.logger.warn(
      `SW-DIAG content-type=${contentType} twilioSig=${twilioSig ? 'yes(' + twilioSig.length + ')' : 'no'} ` +
        `signalwireSig=${signalwireSig ? 'yes' : 'no'} keys=[${Object.keys(payload ?? {}).join(',')}] ` +
        `sigValue=${twilioSig ?? signalwireSig ?? 'none'}`,
    );
    // Verify the Twilio-compatible HMAC signature before trusting `From`.
    // Without this, anyone could POST a spoofed From and send mail from a
    // victim's connected Gmail. Fails closed.
    this.webhookSecurity.verifySignalwire(twilioSig ?? signalwireSig, payload);
    // TwiML: top-level From/Body; SWML: nested under payload.message.from/body
    const msg = payload['message'] ?? {};
    const from: string = payload['From'] ?? payload['from'] ?? msg['from'] ?? '';
    const body: string = payload['Body'] ?? payload['body'] ?? msg['body'] ?? '';
    if (from && body !== undefined) {
      await this.webhooksService.handleInboundSms(from, body);
    } else {
      // Don't log the raw payload — it contains the message body + phone number.
      this.logger.warn('SignalWire webhook missing from/body');
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
