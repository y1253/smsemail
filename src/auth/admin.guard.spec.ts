import { ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

// ADMIN_EMAILS allowlist + Google-federated MFA (ASVS 4.1.3 / CASA admin MFA).
describe('AdminGuard', () => {
  const config = { get: () => 'boss@example.com, other@example.com' } as any;
  const guard = new AdminGuard(config);

  const ctx = (user: unknown) =>
    ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as any;

  it('admits an allowlisted admin who signed in with Google', () => {
    expect(guard.canActivate(ctx({ email: 'boss@example.com', amr: 'google' }))).toBe(true);
  });

  it('is case-insensitive on the allowlist', () => {
    expect(guard.canActivate(ctx({ email: 'BOSS@Example.com', amr: 'google' }))).toBe(true);
  });

  it('refuses an allowlisted admin on a password-only session', () => {
    // The second factor is the point: being on the allowlist is not enough.
    expect(() => guard.canActivate(ctx({ email: 'boss@example.com', amr: 'pwd' }))).toThrow(
      ForbiddenException,
    );
  });

  it('refuses a token with no amr claim at all', () => {
    expect(() => guard.canActivate(ctx({ email: 'boss@example.com' }))).toThrow(
      ForbiddenException,
    );
  });

  it('refuses a non-admin even with a Google session', () => {
    expect(() => guard.canActivate(ctx({ email: 'nobody@example.com', amr: 'google' }))).toThrow(
      ForbiddenException,
    );
  });

  it('refuses an unauthenticated request', () => {
    expect(() => guard.canActivate(ctx(undefined))).toThrow(ForbiddenException);
  });
});
