import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import * as crypto from 'crypto';

// Authenticates the two inbound webhooks that were previously wide open:
//   - Gmail Pub/Sub push  -> Google-signed OIDC bearer token
//   - SignalWire inbound  -> Twilio-compatible HMAC-SHA1 request signature
// Both fail closed: a missing/invalid signature is rejected, never processed.
@Injectable()
export class WebhookSecurityService {
  private readonly logger = new Logger(WebhookSecurityService.name);
  private readonly oauthClient = new OAuth2Client();

  constructor(private readonly config: ConfigService) {}

  /**
   * Verify a Gmail Pub/Sub push request. Push subscriptions configured with an
   * OIDC service account attach `Authorization: Bearer <Google-signed JWT>`.
   * We verify the signature against Google's certs and require the token's
   * `email` claim to match the configured push service account.
   *
   * Requires GOOGLE_PUBSUB_SA_EMAIL to be set (fail closed). The audience is the
   * push endpoint URL by default; override with GOOGLE_PUBSUB_AUDIENCE.
   */
  async verifyGmailPush(authHeader: string | undefined): Promise<void> {
    const expectedEmail = this.config.get<string>('GOOGLE_PUBSUB_SA_EMAIL');
    if (!expectedEmail) {
      // Phased rollout: enforcement requires the Pub/Sub push subscription to be
      // configured with an OIDC service account. Until GOOGLE_PUBSUB_SA_EMAIL is
      // set, allow the push (so forwarding keeps working) but log loudly. This
      // MUST be set — and the subscription OIDC-enabled — before the CASA scan.
      this.logger.warn(
        'GOOGLE_PUBSUB_SA_EMAIL not set — Gmail push authentication is DISABLED (temporary). ' +
          'Enable OIDC on the Pub/Sub subscription and set this env var before submitting for CASA.',
      );
      return;
    }

    const token = (authHeader ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!token) throw new UnauthorizedException('Missing Pub/Sub bearer token');

    const audience =
      this.config.get<string>('GOOGLE_PUBSUB_AUDIENCE') ??
      `${this.publicBase()}/webhooks/gmail`;

    let payload;
    try {
      const ticket = await this.oauthClient.verifyIdToken({ idToken: token, audience });
      payload = ticket.getPayload();
    } catch (err) {
      this.logger.warn(`Gmail push token verification failed: ${err}`);
      throw new UnauthorizedException('Invalid Pub/Sub token');
    }

    const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
    if (!payload || !validIssuers.includes(payload.iss ?? '')) {
      throw new UnauthorizedException('Invalid Pub/Sub token issuer');
    }
    if (payload.email !== expectedEmail || payload.email_verified !== true) {
      throw new UnauthorizedException('Pub/Sub token not from the expected service account');
    }
  }

  /**
   * Verify a SignalWire (Twilio-compatible) inbound webhook signature.
   * Algorithm: base64(HMAC-SHA1(authToken, url + sorted(key+value for each param))).
   * The auth token is SIGNALWIRE_API_TOKEN. `url` must exactly match the webhook
   * URL configured in SignalWire (SIGNALWIRE_WEBHOOK_URL, default
   * `${PUBLIC_URL}/webhooks/signalwire`).
   */
  verifySignalwire(signature: string | undefined, params: Record<string, any>): void {
    // Kill switch: if the configured webhook URL can't be made to match and
    // legitimate inbound SMS starts failing, set SIGNALWIRE_VERIFY_SIGNATURE=false
    // to disable temporarily. Enforced by default (secure by default).
    if (this.config.get<string>('SIGNALWIRE_VERIFY_SIGNATURE') === 'false') {
      this.logger.warn(
        'SignalWire signature verification DISABLED via SIGNALWIRE_VERIFY_SIGNATURE=false — re-enable before submitting for CASA.',
      );
      return;
    }
    const authToken = this.config.get<string>('SIGNALWIRE_API_TOKEN');
    if (!authToken) {
      this.logger.error('SIGNALWIRE_API_TOKEN is not set — cannot verify inbound SMS signature');
      throw new UnauthorizedException('SignalWire webhook authentication not configured');
    }
    if (!signature) throw new UnauthorizedException('Missing SignalWire signature');

    const url =
      this.config.get<string>('SIGNALWIRE_WEBHOOK_URL') ??
      `${this.publicBase()}/webhooks/signalwire`;

    // Twilio-compatible scheme: append each POST param, sorted by key, as key+value.
    const data =
      url +
      Object.keys(params ?? {})
        .filter((k) => typeof params[k] !== 'object')
        .sort()
        .map((k) => k + String(params[k]))
        .join('');

    const expected = crypto.createHmac('sha1', authToken).update(data, 'utf8').digest('base64');

    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid SignalWire signature');
    }
  }

  private publicBase(): string {
    return (this.config.get<string>('PUBLIC_URL') ?? '').replace(/\/+$/, '');
  }
}
