import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Runs AFTER AuthGuard (which validates the JWT and sets request.user).
// Two independent conditions must both hold:
//
//   1. The caller's email is in the ADMIN_EMAILS allowlist — real per-user
//      authorisation, replacing the old shared x-admin-password header.
//   2. The session was established through Google sign-in (amr === 'google'),
//      so Google enforced that account's factors. Admin Google accounts are
//      required to have 2-Step Verification enabled, which is what gives the
//      administrative interface multi-factor authentication. A password-only
//      session is refused here even if the email is on the allowlist.
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const email: string | undefined = request.user?.email;
    const amr: string | undefined = request.user?.amr;

    const allowlist = (this.config.get<string>('ADMIN_EMAILS') ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (!email || !allowlist.includes(email.toLowerCase())) {
      throw new ForbiddenException('Admin access required');
    }

    // Second factor. Deliberately a separate message: the caller has already
    // proved they are an allowlisted admin, so naming the reason reveals
    // nothing they do not know, and it tells them how to get in.
    if (amr !== 'google') {
      throw new ForbiddenException(
        'Admin access requires signing in with Google, which enforces two-step verification. Sign out and use "Continue with Google".',
      );
    }

    return true;
  }
}
