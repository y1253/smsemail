import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Runs AFTER AuthGuard (which validates the JWT and sets request.user).
// Authorises only users whose email is in the ADMIN_EMAILS allowlist — real
// per-user authentication with a role check, replacing the old shared
// x-admin-password header.
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const email: string | undefined = request.user?.email;

    const allowlist = (this.config.get<string>('ADMIN_EMAILS') ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (!email || !allowlist.includes(email.toLowerCase())) {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
