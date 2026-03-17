import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RestClient } from '@signalwire/compatibility-api';

@Injectable()
export class SignalwireService {
  private readonly client: ReturnType<typeof RestClient> | null = null;
  private readonly fromNumber: string;

  constructor(private readonly config: ConfigService) {
    const projectId = this.config.get<string>('SIGNALWIRE_PROJECT_ID');
    const token = this.config.get<string>('SIGNALWIRE_API_TOKEN');
    const spaceUrl = this.config.get<string>('SIGNALWIRE_SPACE_URL');
    const from =
      this.config.get<string>('SIGNALWIRE_FROM_NUMBER') ||
      this.config.get<string>('SIGNALWIRE_PHONE_NUMBER') ||
      '';
    this.fromNumber = from.startsWith('+') ? from : `+${from}`;

    if (projectId && token && spaceUrl && this.fromNumber) {
      this.client = RestClient(projectId, token, {
        signalwireSpaceUrl: spaceUrl,
      });
    } else {
      this.client = null;
    }
  }

  /**
   * Send an SMS via SignalWire. Reusable from any module that imports SignalwireModule.
   * @param to - E.164 phone number (e.g. +15551234567)
   * @param body - Message text
   * @returns message sid or throws if not configured or send fails
   */
  async sendSms(to: string, body: string): Promise<string> {
    if (!this.client) {
      throw new Error(
        'SignalWire is not configured. Set SIGNALWIRE_PROJECT_ID, SIGNALWIRE_API_TOKEN, SIGNALWIRE_SPACE_URL, SIGNALWIRE_FROM_NUMBER in .env',
      );
    }

    const normalizedTo = to.startsWith('+') ? to : `+${to}`;

    return new Promise((resolve, reject) => {
      this.client!.messages
        .create({
          from: this.fromNumber,
          to: normalizedTo,
          body,
        })
        .then((message: { sid: string }) => resolve(message.sid))
        .catch(reject);
    });
  }
}
