import { PhonesService } from './phones.service';

function makeHarness() {
  const userRepo = { findOne: jest.fn().mockResolvedValue({ userId: 1 }) };
  const phoneRepo = { find: jest.fn(), findOne: jest.fn() };
  const deletedPhoneRepo = {};
  const verificationRepo = {
    delete: jest.fn(),
    create: jest.fn((d: any) => ({ ...d })),
    save: jest.fn(),
  };
  const signalwireService = { sendSms: jest.fn().mockResolvedValue('sm-1') };

  const service = new PhonesService(
    userRepo as never,
    phoneRepo as never,
    deletedPhoneRepo as never,
    verificationRepo as never,
    signalwireService as never,
    {} as never,
  );

  return { service, signalwireService, verificationRepo };
}

describe('PhonesService.sendVerificationCode', () => {
  // Mail summaries are sent with a 48h validity so an overnight-off phone still
  // gets them. A verification code must not inherit that: the code dies in 10
  // minutes, and a text that surfaces two days later is only confusing.
  it('expires the text with the code, not 48h later', async () => {
    const h = makeHarness();

    await h.service.sendVerificationCode(1, '15550001111', true);

    const [, body, validitySeconds] = h.signalwireService.sendSms.mock.calls[0];
    expect(body).toContain('verification code');
    expect(validitySeconds).toBe(10 * 60);
  });
});
