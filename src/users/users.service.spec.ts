import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';

// The change-password guarantee: the current password must be proven before the
// hash is replaced, and a Google-only account (no hash at all) can never take
// this path — the UI hides the form, this is the server-side half of that rule.
describe('UsersService password + profile', () => {
  const CURRENT = 'current-password-123';
  const NEXT = 'brand-new-password-456';

  function build(user: any) {
    const userRepo = {
      findOneBy: jest.fn().mockResolvedValue(user),
      findOne: jest.fn().mockResolvedValue(user),
      save: jest.fn(async (v) => v),
      create: jest.fn((v) => ({ ...v })),
    };
    const jwtService = { signAsync: jest.fn().mockResolvedValue('token') };
    const googleClient = {};
    const mailer = { sendMail: jest.fn().mockResolvedValue(undefined) };

    const svc = new UsersService(
      userRepo as any,
      jwtService as any,
      googleClient as any,
      mailer as any,
    );
    return { svc, userRepo, mailer };
  }

  async function passwordUser(overrides: Record<string, unknown> = {}) {
    return {
      userId: 1,
      email: 'owner@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      authType: 'reg',
      password: await bcrypt.hash(CURRENT, 10),
      ...overrides,
    };
  }

  describe('changePassword', () => {
    it('replaces the hash when the current password is correct', async () => {
      const user = await passwordUser();
      const oldHash = user.password;
      const { svc, userRepo } = build(user);

      await expect(
        svc.changePassword(1, {
          current_password: CURRENT,
          new_password: NEXT,
        }),
      ).resolves.toEqual({ ok: true, token: 'token' });

      expect(userRepo.save).toHaveBeenCalledTimes(1);
      const saved = userRepo.save.mock.calls[0][0];
      expect(saved.password).not.toBe(oldHash);
      // Stored as a hash, never as plaintext, and it verifies.
      expect(saved.password).not.toBe(NEXT);
      await expect(bcrypt.compare(NEXT, saved.password)).resolves.toBe(true);
    });

    it('rejects a wrong current password without saving', async () => {
      const { svc, userRepo } = build(await passwordUser());

      await expect(
        svc.changePassword(1, {
          current_password: 'not-the-password',
          new_password: NEXT,
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('refuses a Google-only account that has no password', async () => {
      const { svc, userRepo } = build(
        await passwordUser({ authType: 'google', password: null }),
      );

      await expect(
        svc.changePassword(1, {
          current_password: CURRENT,
          new_password: NEXT,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('refuses a new password identical to the current one', async () => {
      const { svc, userRepo } = build(await passwordUser());

      await expect(
        svc.changePassword(1, {
          current_password: CURRENT,
          new_password: CURRENT,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('bumps tokenVersion so other devices are signed out', async () => {
      const { svc, userRepo } = build(await passwordUser({ tokenVersion: 3 }));

      await svc.changePassword(1, {
        current_password: CURRENT,
        new_password: NEXT,
      });

      const saved = userRepo.save.mock.calls[0][0];
      // Every JWT minted at generation 3 stops verifying once this lands.
      expect(saved.tokenVersion).toBe(4);
    });

    it('treats a missing tokenVersion as generation 0', async () => {
      const user = await passwordUser();
      delete (user as Record<string, unknown>).tokenVersion;
      const { svc, userRepo } = build(user);

      await svc.changePassword(1, {
        current_password: CURRENT,
        new_password: NEXT,
      });

      expect(userRepo.save.mock.calls[0][0].tokenVersion).toBe(1);
    });

    it('404s for a missing user', async () => {
      const { svc } = build(null);

      await expect(
        svc.changePassword(1, {
          current_password: CURRENT,
          new_password: NEXT,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('clears the temp-password expiry, so the chosen password never expires', async () => {
      const user = await passwordUser({
        tempPasswordExpiresAt: new Date(Date.now() + 60_000),
      });
      const { svc, userRepo } = build(user);

      await svc.changePassword(1, {
        current_password: CURRENT,
        new_password: NEXT,
      });

      expect(userRepo.save.mock.calls[0][0].tempPasswordExpiresAt).toBeNull();
    });
  });

  // The forgot-password guarantees: every outcome the user could be waiting on
  // is reported distinctly rather than collapsed into one ok, and the stored
  // hash is only replaced once the email carrying its plaintext has actually
  // gone out — a failed send must never leave someone locked out.
  describe('forgotPassword', () => {
    /** Pull the temp password back out of the email the service built. */
    function sentPassword(mailer: { sendMail: jest.Mock }): string {
      const { text } = mailer.sendMail.mock.calls[0][0];
      const match = text.match(/Temporary password: (\S+)/);
      expect(match).not.toBeNull();
      return match![1];
    }

    it('reports an unknown address instead of pretending to send', async () => {
      const { svc, userRepo, mailer } = build(null);

      await expect(svc.forgotPassword('nobody@example.com')).rejects.toThrow(
        NotFoundException,
      );

      expect(mailer.sendMail).not.toHaveBeenCalled();
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('emails a working temp password and stores only its hash', async () => {
      const user = await passwordUser();
      const oldHash = user.password;
      const { svc, userRepo, mailer } = build(user);

      await expect(svc.forgotPassword(user.email)).resolves.toEqual({
        ok: true,
      });

      const temp = sentPassword(mailer);
      const saved = userRepo.save.mock.calls[0][0];

      expect(saved.password).not.toBe(oldHash);
      expect(saved.password).not.toBe(temp);
      await expect(bcrypt.compare(temp, saved.password)).resolves.toBe(true);
      // Long enough to satisfy the MinLength(12) policy it has to live under.
      expect(temp.length).toBeGreaterThanOrEqual(12);
      expect(saved.tempPasswordExpiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('bumps tokenVersion, so a reset kills every existing session', async () => {
      const { svc, userRepo } = build(await passwordUser({ tokenVersion: 7 }));

      await svc.forgotPassword('owner@example.com');

      expect(userRepo.save.mock.calls[0][0].tokenVersion).toBe(8);
    });

    it('never reuses a temp password', async () => {
      const a = build(await passwordUser());
      const b = build(await passwordUser());

      await a.svc.forgotPassword('owner@example.com');
      await b.svc.forgotPassword('owner@example.com');

      expect(sentPassword(a.mailer)).not.toBe(sentPassword(b.mailer));
    });

    it('points a Google-only account at Google without setting a password', async () => {
      const user = await passwordUser({ authType: 'google', password: null });
      const { svc, userRepo, mailer } = build(user);

      await expect(svc.forgotPassword(user.email)).rejects.toThrow(
        BadRequestException,
      );

      // Said on screen, not mailed — there is nothing to deliver.
      expect(mailer.sendMail).not.toHaveBeenCalled();
      // No hash written — the account still has no password at all.
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('leaves the old password intact when the email fails to send', async () => {
      const user = await passwordUser();
      const oldHash = user.password;
      const { svc, userRepo, mailer } = build(user);
      mailer.sendMail.mockRejectedValue(new Error('smtp down'));

      await expect(svc.forgotPassword(user.email)).rejects.toThrow(
        ServiceUnavailableException,
      );

      // The invariant that matters: nothing was written, so the password the
      // user already has still works and they are not locked out.
      expect(userRepo.save).not.toHaveBeenCalled();
      expect(user.password).toBe(oldHash);
    });
  });

  describe('login', () => {
    it('rejects a temp password past its expiry', async () => {
      const user = await passwordUser({
        tempPasswordExpiresAt: new Date(Date.now() - 60_000),
      });
      const { svc } = build(user);

      await expect(
        svc.login({ email: user.email, password: CURRENT }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('accepts a temp password inside its window', async () => {
      const user = await passwordUser({
        tempPasswordExpiresAt: new Date(Date.now() + 60_000),
      });
      const { svc } = build(user);

      await expect(
        svc.login({ email: user.email, password: CURRENT }),
      ).resolves.toBe('token');
    });
  });

  describe('updateProfile', () => {
    it('writes both names', async () => {
      const { svc, userRepo } = build(await passwordUser());

      await svc.updateProfile(1, { first_name: 'Grace', last_name: 'Hopper' });

      const saved = userRepo.save.mock.calls[0][0];
      expect(saved.firstName).toBe('Grace');
      expect(saved.lastName).toBe('Hopper');
    });

    it('clears the last name when it is omitted', async () => {
      const { svc, userRepo } = build(await passwordUser());

      await svc.updateProfile(1, { first_name: 'Grace' });

      expect(userRepo.save.mock.calls[0][0].lastName).toBeNull();
    });

    it('never touches the password', async () => {
      const user = await passwordUser();
      const hash = user.password;
      const { svc, userRepo } = build(user);

      await svc.updateProfile(1, { first_name: 'Grace' });

      expect(userRepo.save.mock.calls[0][0].password).toBe(hash);
    });

    it('404s for a missing user', async () => {
      const { svc } = build(null);

      await expect(
        svc.updateProfile(1, { first_name: 'Grace' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getProfile', () => {
    it('selects authType so the client can spot a Google account', async () => {
      const { svc, userRepo } = build(await passwordUser());

      await svc.getProfile(1);

      expect(userRepo.findOne.mock.calls[0][0].select).toContain('authType');
    });
  });
});
