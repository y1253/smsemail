import { SignalwireService } from './signalwire.service';

const create = jest.fn();

jest.mock('@signalwire/compatibility-api', () => ({
  RestClient: jest.fn(() => ({ messages: { create } })),
}));

const MAX = 172800; // SignalWire's documented ceiling for ValidityPeriod (48h)

function makeService(env: Record<string, string> = {}) {
  const base: Record<string, string> = {
    SIGNALWIRE_PROJECT_ID: 'proj',
    SIGNALWIRE_API_TOKEN: 'tok',
    SIGNALWIRE_SPACE_URL: 'example.signalwire.com',
    SIGNALWIRE_FROM_NUMBER: '15550000000',
    ...env,
  };
  const config = { get: (k: string) => base[k] } as never;
  return new SignalwireService(config);
}

/** The options object handed to messages.create on the Nth (default first) send. */
function sentOptions(n = 0) {
  return create.mock.calls[n][0];
}

beforeEach(() => {
  create.mockReset();
  create.mockResolvedValue({ sid: 'sm-1' });
});

describe('SignalwireService — message validity period', () => {
  // Without an explicit ValidityPeriod SignalWire applies its own default of
  // 14400s (4h) and cancels anything still undelivered, which silently drops
  // mail summaries to a handset left powered off overnight.
  it('always sends a validity period', async () => {
    await makeService().sendSms('15551234567', 'hi');

    expect(sentOptions().validityPeriod).toBeDefined();
  });

  it('defaults to the 48h provider maximum', async () => {
    await makeService().sendSms('15551234567', 'hi');

    expect(sentOptions().validityPeriod).toBe(MAX);
  });

  it('honours SIGNALWIRE_VALIDITY_SECONDS', async () => {
    await makeService({ SIGNALWIRE_VALIDITY_SECONDS: '14400' }).sendSms(
      '15551234567',
      'hi',
    );

    expect(sentOptions().validityPeriod).toBe(14400);
  });

  // Anything above the cap is a 400 from SignalWire, which would break every
  // outgoing text — so clamp rather than pass it through.
  it('clamps a configured value above the provider maximum', async () => {
    await makeService({ SIGNALWIRE_VALIDITY_SECONDS: '198000' }).sendSms(
      '15551234567',
      'hi',
    );

    expect(sentOptions().validityPeriod).toBe(MAX);
  });

  it('clamps a configured value below the minimum', async () => {
    await makeService({ SIGNALWIRE_VALIDITY_SECONDS: '0' }).sendSms(
      '15551234567',
      'hi',
    );

    expect(sentOptions().validityPeriod).toBe(1);
  });

  it('falls back to the default when the value is not a number', async () => {
    await makeService({ SIGNALWIRE_VALIDITY_SECONDS: 'soon' }).sendSms(
      '15551234567',
      'hi',
    );

    expect(sentOptions().validityPeriod).toBe(MAX);
  });

  it('lets a caller shorten it per message', async () => {
    await makeService().sendSms('15551234567', 'code: 123456', 600);

    expect(sentOptions().validityPeriod).toBe(600);
  });

  it('clamps a per-message override to the provider maximum too', async () => {
    await makeService().sendSms('15551234567', 'hi', 999999);

    expect(sentOptions().validityPeriod).toBe(MAX);
  });
});

describe('SignalwireService — send basics', () => {
  it('normalizes both numbers to E.164 and returns the sid', async () => {
    const sid = await makeService().sendSms('15551234567', 'hi');

    expect(sentOptions().to).toBe('+15551234567');
    expect(sentOptions().from).toBe('+15550000000');
    expect(sid).toBe('sm-1');
  });

  it('throws instead of silently dropping the text when unconfigured', async () => {
    const config = { get: () => undefined } as never;

    await expect(
      new SignalwireService(config).sendSms('15551234567', 'hi'),
    ).rejects.toThrow('SignalWire is not configured');
  });
});
