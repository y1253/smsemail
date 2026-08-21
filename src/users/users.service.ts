import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
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
import {
  googleAccountEmail,
  tempPasswordEmail,
} from '../mailer/password-reset.email';

type JwtPayload = {
  user_id: number;
  email: string;
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
    await this.userRepo.save(user);

    return { ok: true };
  }

  /**
   * Email a temporary password to the owner of `email`.
   *
   * Always resolves to `{ ok: true }` — including for unknown addresses and
   * for send failures — so the endpoint can't be used to enumerate accounts
   * (ASVS 2.2.2, the same reasoning as DUMMY_HASH in login).
   */
  async forgotPassword(email: string): Promise<{ ok: true }> {
    const user = await this.getUserByEmail(email);
    const publicUrl = (
      process.env.PUBLIC_URL || 'https://emailontext.com'
    ).replace(/\/+$/, '');
    const loginUrl = `${publicUrl}/login`;

    if (!user || !user.email) {
      return { ok: true };
    }

    // Google-only rows have no hash to replace. Same rule changePassword
    // enforces — tell them where to sign in instead of silently doing nothing.
    if (!user.password) {
      await this.trySend(
        user.email,
        googleAccountEmail({ firstName: user.firstName, loginUrl }),
      );
      return { ok: true };
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
      return { ok: true };
    }

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + TEMP_PASSWORD_EXPIRY_MINUTES);

    user.password = await this.hashPassword(tempPassword);
    user.tempPasswordExpiresAt = expiresAt;
    await this.userRepo.save(user);

    return { ok: true };
  }

  /** Send, swallowing failures into `false` so callers stay non-enumerating. */
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

    const { userId } = await this.userRepo.save(account);

    return this.jwtService.signAsync({ user_id: userId, email });
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
  }: {
    userId: number;
    email: string;
  }): Promise<string> {
    const payload: JwtPayload = { user_id: userId, email };
    return await this.jwtService.signAsync(payload);
  }

  private async hashPassword(password: string) {
    return await bcrypt.hash(password, 10);
  }
}

