import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './user.entity';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'node:crypto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { MailerService } from '../mailer/mailer.service';
import { tempPasswordEmail } from '../mailer/password-reset.email';

type JwtPayload = {
  user_id: number;
  email: string;
  /** Session generation. AuthGuard rejects a token whose tv is stale. */
  tv: number;
  /**
   * Authentication Method Reference: how this session was established.
   * 'google' means the user completed a Google sign-in, so Google enforced
   * whatever factors that account requires. AdminGuard accepts only 'google',
   * which is how administrative access gets multi-factor authentication.
   */
  amr: 'google' | 'pwd';
};

/** How long an emailed temporary password stays usable. */
const TEMP_PASSWORD_EXPIRY_MINUTES = 30;

/**
 * Alphabet for generated temporary passwords. No 0/O/1/l/I — the password is
 * read off a screen and retyped, so ambiguous glyphs cost support tickets.
 */
const TEMP_PASSWORD_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    @Inject('GOOGLE_CLIENT')
    private readonly googleClient: OAuth2Client,
    private readonly mailer: MailerService,
  ) { }

  async getProfile(userId: number) {
    const user = await this.userRepo.findOne({
      where: { userId },
      // authType tells the client whether this account has a password at all —
      // Google-only rows have none, so the UI hides the change-password form.
      select: ['userId', 'firstName', 'lastName', 'email', 'authType'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const user = await this.userRepo.findOneBy({ userId });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.firstName = dto.first_name;
    user.lastName = dto.last_name ?? null;
    await this.userRepo.save(user);

    return this.getProfile(userId);
  }

  /**
   * Change the password of an email/password account.
   *
   * Note: JWTs here are stateless with a 24h TTL and AuthGuard does no DB
   * lookup, so this does NOT sign the user out on other devices.
   */
  async changePassword(userId: number, dto: ChangePasswordDto) {
    // getProfile's `select` excludes the password column, so fetch the row
    // directly — the hash is what we need to compare against.
    const user = await this.userRepo.findOneBy({ userId });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Google-only accounts have no hash to verify against. The UI hides the
    // form for them; this is the server-side half of the same rule.
    if (!user.password) {
      throw new BadRequestException('This account signs in with Google');
    }

    // A 401 from a caller whose session is perfectly valid. Deliberately carries
    // no SESSION_INVALID code (see auth.service.ts): tagging it would sign the
    // user out of the very page they are typing their password into.
    if (!(await bcrypt.compare(dto.current_password, user.password))) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (dto.current_password === dto.new_password) {
      throw new BadRequestException(
        'New password must be different from the current one',
      );
    }

    user.password = await this.hashPassword(dto.new_password);
    // This password is the user's own choice, so it never expires — clearing
    // the stamp is what ends a forgot-password cycle.
    user.tempPasswordExpiresAt = null;
    // Terminate every session issued before this moment (ASVS 3.3.3). Tokens
    // on other devices carry the old tv and stop verifying immediately.
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await this.userRepo.save(user);

    // The caller's own token was just invalidated along with the rest, so hand
    // back a replacement — the session that performed the change is the one
    // session that should survive it.
    const token = await this.createToken({
      userId: user.userId,
      email: user.email || '',
      tokenVersion: user.tokenVersion,
      // A password change does not upgrade the session's authentication
      // method; it stays whatever it was established with.
      amr: 'pwd',
    });

    return { ok: true as const, token };
  }

  /**
   * Email a temporary password to the owner of `email`.
   *
   * Each outcome is reported distinctly so the page can tell the user what
   * actually happened rather than leaving them waiting on mail that will never
   * arrive: 404 for an unknown address, 400 for a Google-only account, 503 when
   * the send itself fails.
   *
   * Distinguishing those does let a caller confirm whether an address is
   * registered. That is bounded by the route's 3-per-15-minutes rate limit, and
   * `POST /users/create` already discloses the same fact through its 409, so it
   * is not a capability this endpoint adds.
   */
  async forgotPassword(email: string): Promise<{ ok: true }> {
    const user = await this.getUserByEmail(email);
    const publicUrl = (
      process.env.PUBLIC_URL || 'https://emailontext.com'
    ).replace(/\/+$/, '');
    const loginUrl = `${publicUrl}/login`;

    if (!user || !user.email) {
      throw new NotFoundException('No account found for that email address.');
    }

    // Google-only rows have no hash to replace. Same rule changePassword
    // enforces — say so on screen rather than mailing an explanation they have
    // to go and read.
    if (!user.password) {
      throw new BadRequestException(
        'This account signs in with Google. Use the Google button on the sign-in page.',
      );
    }

    const tempPassword = UsersService.generateTempPassword();

    // Send before saving. If Gmail is down, the user must not be left holding
    // a password that was destroyed for a mail that never arrived.
    const sent = await this.trySend(
      user.email,
      tempPasswordEmail({
        firstName: user.firstName,
        tempPassword,
        expiresMinutes: TEMP_PASSWORD_EXPIRY_MINUTES,
        loginUrl,
        accountUrl: `${publicUrl}/account`,
      }),
    );

    if (!sent) {
      // Thrown as an HttpException so the wording survives AllExceptionsFilter,
      // which masks anything else into a generic 500.
      throw new ServiceUnavailableException(
        "We couldn't send the email right now. Please try again in a moment.",
      );
    }

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + TEMP_PASSWORD_EXPIRY_MINUTES);

    user.password = await this.hashPassword(tempPassword);
    user.tempPasswordExpiresAt = expiresAt;
    // A reset is a recovery event: the account may already be compromised, so
    // every existing session dies here, with no survivor. Whoever holds the
    // emailed password must sign in again to get a token (ASVS 3.3.3).
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await this.userRepo.save(user);

    return { ok: true };
  }

  /**
   * Send, turning a failure into `false` rather than an exception, so the
   * caller can decide what the user is told and — critically — skip the
   * password rewrite that would otherwise lock them out.
   */
  private async trySend(
    to: string,
    content: { subject: string; html: string; text: string },
  ): Promise<boolean> {
    try {
      await this.mailer.sendMail({ to, ...content });
      return true;
    } catch (err) {
      this.logger.error(
        `Failed to send "${content.subject}": ${(err as Error).message}`,
      );
      return false;
    }
  }

  /**
   * Three dash-separated groups of four, e.g. `Kq7x-Rm2p-Wt9v`. 14 characters,
   * so it clears the MinLength(12) policy shared by CreateUserDto and
   * ChangePasswordDto. CSPRNG, never Math.random().
   */
  private static generateTempPassword(): string {
    const groups: string[] = [];
    for (let g = 0; g < 3; g++) {
      let group = '';
      for (let i = 0; i < 4; i++) {
        group += TEMP_PASSWORD_ALPHABET[
          randomInt(0, TEMP_PASSWORD_ALPHABET.length)
        ];
      }
      groups.push(group);
    }
    return groups.join('-');
  }

  async createNewUser(newUser: any) {
    const { first_name, last_name, email, password, auth_type = 'reg' } =
      newUser;

    const existing = await this.getUserByEmail(email);

    if (existing) {
      throw new ConflictException('Account already exists');
    }

    const account = this.userRepo.create({
      firstName: first_name,
      lastName: last_name,
      email,
      password: await this.hashPassword(password),
      authType: auth_type,
    });

    const saved = await this.userRepo.save(account);

    return this.createToken({
      userId: saved.userId,
      email,
      tokenVersion: saved.tokenVersion ?? 0,
      amr: 'pwd',
    });
  }

  // A valid bcrypt hash of a random string, used to equalise timing when the
  // account (or its password) doesn't exist — avoids a login-timing oracle that
  // reveals whether an email is registered (ASVS 2.2.2).
  private static readonly DUMMY_HASH =
    '$2b$10$zJQZuvQszFCsN5HCNHJZnOoSY3Ez0l3YKgzitZRSUJHS89Gnx5MaO';

  async login(user: { email: string; password: string }) {
    const savedUser = await this.getUserByEmail(user.email);

    const hash = savedUser?.password || UsersService.DUMMY_HASH;
    const passwordOk = await bcrypt.compare(user.password, hash);

    if (!savedUser || !savedUser.password || !passwordOk) {
      throw new UnauthorizedException('Invalid password or email');
    }

    // Only reachable by someone who already supplied the correct temporary
    // password, so naming the reason here reveals nothing a generic message
    // would have protected.
    if (
      savedUser.tempPasswordExpiresAt &&
      savedUser.tempPasswordExpiresAt < new Date()
    ) {
      throw new UnauthorizedException(
        'This temporary password has expired. Request a new one from the login page.',
      );
    }

    return await this.createToken({
      userId: savedUser.userId,
      email: savedUser.email || '',
      tokenVersion: savedUser.tokenVersion ?? 0,
      amr: 'pwd',
    });
  }

  async googleLogin(credential: string) {
    const { tokens } = await this.googleClient.getToken(credential);
    if (!tokens.id_token) throw new UnauthorizedException('Google did not return an id_token');

    const ticket = await this.googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) throw new UnauthorizedException('Invalid Google token');

    const { email, given_name, family_name } = payload;

    let user = await this.getUserByEmail(email || '');

    if (!user) {
      user = this.userRepo.create({
        email,
        firstName: given_name,
        lastName: family_name,
        authType: 'google',
      });

      user = await this.userRepo.save(user);
    } else {
      // Backfill names for accounts that predate this (or registered by
      // email/password without one). Only fill blanks — never overwrite.
      let changed = false;
      if (!user.firstName && given_name) {
        user.firstName = given_name;
        changed = true;
      }
      if (!user.lastName && family_name) {
        user.lastName = family_name;
        changed = true;
      }
      if (changed) {
        user = await this.userRepo.save(user);
      }
    }

    const accessToken = await this.createToken({
      userId: user.userId,
      email: user.email || '',
      tokenVersion: user.tokenVersion ?? 0,
      amr: 'google',
    });

    return {
      accessToken,
    };
  }

  private async getUserByEmail(email: string) {
    return await this.userRepo.findOneBy({
      email,
    });
  }

  private async createToken({
    userId,
    email,
    tokenVersion,
    amr,
  }: {
    userId: number;
    email: string;
    tokenVersion: number;
    amr: 'google' | 'pwd';
  }): Promise<string> {
    const payload: JwtPayload = { user_id: userId, email, tv: tokenVersion, amr };
    return await this.jwtService.signAsync(payload);
  }

  private async hashPassword(password: string) {
    return await bcrypt.hash(password, 10);
  }
}

