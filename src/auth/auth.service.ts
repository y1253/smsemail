import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

/**
 * Marks the 401s that mean "this session is over", as opposed to the ordinary
 * form-level 401s the same status code carries elsewhere — a wrong login
 * password, or a wrong *current* password on the change-password form, which is
 * sent by a perfectly valid session. The SPA signs the user out on this code
 * alone, so it must never appear on anything but a dead session.
 *
 * POST /users/password is why this is a payload field and not a URL rule: the
 * same method and path returns 401 both for a token this guard rejected and for
 * a mistyped current password, so the client cannot tell them apart from the
 * outside.
 */
export const SESSION_INVALID = 'SESSION_INVALID';

/** Which copy the login page shows. A closed set — the client renders its own
 *  string per value and never echoes anything from the response. */
export type SessionEndReason = 'expired' | 'revoked' | 'invalid';

const sessionOver = (reason: SessionEndReason, message: string) =>
  new UnauthorizedException({
    statusCode: 401,
    message,
    code: SESSION_INVALID,
    reason,
  });

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async validCustomer(request: any): Promise<boolean> {
    // Header only — never a query parameter, so a token cannot leak through a
    // URL, referrer or access log (ASVS 3.1.1).
    const token = request.headers['x-token'];

    if (!token) {
      throw sessionOver('invalid', 'Missing token');
    }

    let decoded: { user_id: number; email: string; tv?: number };
    try {
      decoded = await this.jwtService.verify(token);
    } catch (err: any) {
      // Expiry is the one failure honest users hit — tokens live 24h and there
      // is no refresh — so it gets its own wording and reason. Everything else
      // is malformed or forged and stays deliberately vague. Naming expiry
      // leaks nothing: the caller supplied the token and can read its own
      // unverified `exp`.
      const expired = err?.name === 'TokenExpiredError';
      throw sessionOver(
        expired ? 'expired' : 'invalid',
        expired
          ? 'Your session has expired. Please sign in again.'
          : 'Invalid token',
      );
    }

    // Session-generation check (ASVS 3.3.3). A password change or reset bumps
    // user.token_version, which strands every token minted before it — that is
    // what terminates sessions on other devices despite the JWT being
    // stateless. Tokens issued before this column existed carry no tv and are
    // treated as generation 0, matching the column default, so deploying this
    // does not sign anyone out on its own.
    const current = await this.userRepo.findOne({
      where: { userId: decoded.user_id },
      select: ['userId', 'tokenVersion'],
    });

    if (!current) {
      throw sessionOver('invalid', 'Invalid token');
    }

    if ((decoded.tv ?? 0) !== (current.tokenVersion ?? 0)) {
      throw sessionOver(
        'revoked',
        'Session ended because the account password was changed. Please sign in again.',
      );
    }

    request.user = decoded;
    return true;
  }
}
