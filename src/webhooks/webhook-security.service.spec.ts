import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { WebhookSecurityService } from './webhook-security.service';

describe('WebhookSecurityService.verifySignalwire', () => {
  const TOKEN = 'test_auth_token';
  const URL = 'https://emailontext.com/webhooks/signalwire';

  function makeService(): WebhookSecurityService {
    const config = {
      get: (key: string) =>
        ({
          SIGNALWIRE_API_TOKEN: TOKEN,
          SIGNALWIRE_WEBHOOK_URL: URL,
        })[key],
    } as unknown as ConfigService;
    return new WebhookSecurityService(config);
  }

  // Twilio-compatible: base64(HMAC-SHA1(token, url + sorted(key+value))).
  function sign(params: Record<string, string>): string {
    const data =
      URL +
      Object.keys(params)
        .sort()
        .map((k) => k + params[k])
        .join('');
    return crypto.createHmac('sha1', TOKEN).update(data, 'utf8').digest('base64');
  }

  it('accepts a correctly signed request', () => {
    const service = makeService();
    const params = { From: '+15551234567', Body: 'R 123 hello' };
    expect(() => service.verifySignalwire(sign(params), params)).not.toThrow();
  });

  it('rejects a tampered body (signature no longer matches)', () => {
    const service = makeService();
    const params = { From: '+15551234567', Body: 'R 123 hello' };
    const sig = sign(params);
    const tampered = { ...params, Body: 'S attacker@evil.com | pwned' };
    expect(() => service.verifySignalwire(sig, tampered)).toThrow(UnauthorizedException);
  });

  it('rejects a missing signature', () => {
    const service = makeService();
    expect(() => service.verifySignalwire(undefined, { From: '+1', Body: 'x' })).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a spoofed From with no valid signature', () => {
    const service = makeService();
    const params = { From: '+15559999999', Body: 'S a@b.com | hi' };
    expect(() => service.verifySignalwire('not-a-real-signature', params)).toThrow(
      UnauthorizedException,
    );
  });
});
