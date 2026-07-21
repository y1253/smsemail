import { ForbiddenException } from '@nestjs/common';
import { EmailsService } from './emails.service';

// Focused unit tests for the Gmail-connect guarantee: an account whose Gmail
// access was NOT granted must never be persisted, and a watch failure must roll
// the row back so it can't be selected in a set.
describe('EmailsService.connectGoogleEmail', () => {
  const owner = { userId: 1 };
  const user = { user_id: 1, email: 'owner@example.com' };

  function build(overrides: {
    getToken?: jest.Mock;
    watchGmail?: jest.Mock;
    existingEmail?: any;
  } = {}) {
    const emailRepo = {
      findOne: jest.fn().mockResolvedValue(overrides.existingEmail ?? null),
      create: jest.fn((v) => ({ ...v })),
      save: jest.fn(async (v) => ({ emailId: 10, ...v })),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const deletedEmailRepo = { create: jest.fn(), save: jest.fn() };
    const userRepo = { findOne: jest.fn().mockResolvedValue(owner) };
    const config = {
      get: jest.fn((k: string) =>
        k === 'REFRESH_TOKEN_KEY' ? '0123456789abcdef0123456789abcdef' : 'test',
      ),
    };
    const googleClient = {
      getToken:
        overrides.getToken ??
        jest.fn().mockResolvedValue({
          tokens: {
            refresh_token: 'rt',
            id_token: 'idt',
            scope: 'email profile https://mail.google.com/',
          },
        }),
      verifyIdToken: jest.fn().mockResolvedValue({
        getPayload: () => ({ email: 'connected@example.com' }),
      }),
    };
    const gmailService = {
      watchGmail:
        overrides.watchGmail ??
        jest.fn().mockResolvedValue({ historyId: '123', expiry: new Date(0) }),
      unwatchGmail: jest.fn().mockResolvedValue(undefined),
      revokeAccess: jest.fn().mockResolvedValue(undefined),
    };
    const setsService = { teardownSetsForEmail: jest.fn() };

    const svc = new EmailsService(
      emailRepo as any,
      deletedEmailRepo as any,
      userRepo as any,
      config as any,
      googleClient as any,
      gmailService as any,
      setsService as any,
    );
    return { svc, emailRepo, googleClient, gmailService };
  }

  it('rejects and persists nothing when the Gmail scope was not granted', async () => {
    const { svc, emailRepo, gmailService } = build({
      getToken: jest.fn().mockResolvedValue({
        tokens: { refresh_token: 'rt', id_token: 'idt', scope: 'email profile' },
      }),
    });

    await expect(
      svc.connectGoogleEmail({ code: 'c' } as any, user as any),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(emailRepo.save).not.toHaveBeenCalled();
    expect(emailRepo.create).not.toHaveBeenCalled();
    expect(gmailService.watchGmail).not.toHaveBeenCalled();
  });

  it('rolls back a newly-created row when the Gmail watch fails', async () => {
    const { svc, emailRepo, gmailService } = build({
      watchGmail: jest.fn().mockRejectedValue(new Error('insufficient permission')),
    });

    await expect(
      svc.connectGoogleEmail({ code: 'c' } as any, user as any),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // The row was saved, then removed — never left selectable.
    expect(emailRepo.remove).toHaveBeenCalledTimes(1);
    // The grant obtained from the token exchange is revoked, not left dangling.
    expect(gmailService.revokeAccess).toHaveBeenCalledWith('rt');
  });

  it('connects successfully when the Gmail scope is granted', async () => {
    const { svc, emailRepo, gmailService } = build();

    const res = await svc.connectGoogleEmail({ code: 'c' } as any, user as any);

    expect(gmailService.watchGmail).toHaveBeenCalledTimes(1);
    expect(emailRepo.remove).not.toHaveBeenCalled();
    expect(res.email).toBe('connected@example.com');
  });
});
