import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RestClient } from '@signalwire/compatibility-api';

// How long SignalWire may hold an undelivered message before cancelling it
// (error 30001). SignalWire's own default is 4 hours, which quietly drops mail
// summaries for a handset that stays powered off overnight — so we ask for the
// documented maximum instead. 172800s is a hard provider cap, not a preference.
const MAX_VALIDITY_SECONDS = 172800; // 48h
const DEFAULT_VALIDITY_SECONDS = MAX_VALIDITY_SECONDS;

@Injectable()
export class SignalwireService {
  private readonly logger = new Logger(SignalwireService.name);
  private readonly client: ReturnType<typeof RestClient> | null = null;
  private readonly fromNumber: string;
  private readonly validitySeconds: number;

  constructor(private readonly config: ConfigService) {
    const projectId = this.config.get<string>('SIGNALWIRE_PROJECT_ID');
    const token = this.config.get<string>('SIGNALWIRE_API_TOKEN');
    const spaceUrl = this.config.get<string>('SIGNALWIRE_SPACE_URL');
    const from =
      this.config.get<string>('SIGNALWIRE_FROM_NUMBER') ||
      this.config.get<string>('SIGNALWIRE_PHONE_NUMBER') ||
      '';
    this.fromNumber = from.startsWith('+') ? from : `+${from}`;
    this.validitySeconds = this.resolveValiditySeconds();

    if (projectId && token && spaceUrl && this.fromNumber) {
      this.client = RestClient(projectId, token, {
        signalwireSpaceUrl: spaceUrl,
      });
    } else {
      this.client = null;
    }
  }

  // Configurable so the cap can be lowered from .env without a code change if
  // SignalWire ever rejects the maximum for this account.
  private resolveValiditySeconds(): number {
    const raw = this.config.get<string>('SIGNALWIRE_VALIDITY_SECONDS');
    if (raw === undefined || raw === null || String(raw).trim() === '')
      return DEFAULT_VALIDITY_SECONDS;

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      this.logger.warn(
        `SIGNALWIRE_VALIDITY_SECONDS="${raw}" is not an integer — falling back to ${DEFAULT_VALIDITY_SECONDS}s.`,
      );
      return DEFAULT_VALIDITY_SECONDS;
    }
    if (parsed < 1 || parsed > MAX_VALIDITY_SECONDS) {
      const clamped = Math.min(Math.max(parsed, 1), MAX_VALIDITY_SECONDS);
      this.logger.warn(
        `SIGNALWIRE_VALIDITY_SECONDS=${parsed} is outside SignalWire's accepted range 1-${MAX_VALIDITY_SECONDS} — using ${clamped}s.`,
      );
      return clamped;
    }
    return parsed;
  }

  /**
   * Send an SMS via SignalWire. Reusable from any module that imports SignalwireModule.
   * @param to - E.164 phone number (e.g. +15551234567)
   * @param body - Message text
   * @param validitySeconds - Optional per-message override for how long SignalWire
   *   may keep retrying delivery. Defaults to 48h (SIGNALWIRE_VALIDITY_SECONDS).
   *   Pass something short for time-sensitive texts — a verification code that
   *   surfaces two days later is worse than one that never arrives.
   * @returns message sid or throws if not configured or send fails
   */
  async sendSms(
    to: string,
    body: string,
    validitySeconds?: number,
  ): Promise<string> {
    if (!this.client) {
      throw new Error(
        'SignalWire is not configured. Set SIGNALWIRE_PROJECT_ID, SIGNALWIRE_API_TOKEN, SIGNALWIRE_SPACE_URL, SIGNALWIRE_FROM_NUMBER in .env',
      );
    }

    const normalizedTo = to.startsWith('+') ? to : `+${to}`;
    const validityPeriod = Math.min(
      Math.max(Math.trunc(validitySeconds ?? this.validitySeconds), 1),
      MAX_VALIDITY_SECONDS,
    );

    return new Promise((resolve, reject) => {
      this.client!.messages.create({
        from: this.fromNumber,
        to: normalizedTo,
        body,
        validityPeriod,
      })
        .then((message: { sid: string }) => resolve(message.sid))
        .catch(reject);
    });
  }
}
