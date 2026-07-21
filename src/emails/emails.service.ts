import { Injectable, BadRequestException, ForbiddenException, Inject, Logger, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Email } from './email.entity';
import { DeletedEmail } from './deleted-email.entity';
import { User } from '../users/user.entity';
import { ConnectGoogleEmailDto } from './dto/connect-google-email.dto';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { GmailService } from '../gmail/gmail.service';
import { SetsService } from '../sets/sets.service';

type JwtPayload = {
  user_id: number;
  email: string;
};

// Full-mailbox scope. Users grant it via a checkbox on Google's consent screen
// that they can miss or leave unchecked — without it we can't watch/read/send
// Gmail, so we must reject the connect before persisting anything.
const REQUIRED_GMAIL_SCOPE = 'https://mail.google.com/';

@Injectable()
export class EmailsService {
  private readonly encryptionKey: Buffer;
  private readonly logger = new Logger(EmailsService.name);

  constructor(
    @InjectRepository(Email)
    private readonly emailRepo: Repository<Email>,
    @InjectRepository(DeletedEmail)
    private readonly deletedEmailRepo: Repository<DeletedEmail>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly config: ConfigService,
    @Inject('GOOGLE_CLIENT')
    private readonly googleClient: OAuth2Client,
    private readonly gmailService: GmailService,
    @Inject(forwardRef(() => SetsService))
    private readonly setsService: SetsService,
  ) {
    const key = this.config.get<string>('REFRESH_TOKEN_KEY');
    if (!key || key.length < 32) {
      throw new Error('REFRESH_TOKEN_KEY must be set and at least 32 characters');
    }
    this.encryptionKey = Buffer.from(key.slice(0, 32));
  }

  async connectGoogleEmail(dto: ConnectGoogleEmailDto, user: JwtPayload) {
    const owner = await this.userRepo.findOne({ where: { userId: user.user_id } });
    if (!owner) {
      throw new BadRequestException('User not found');
    }

    

    if (!dto.code) {
      throw new BadRequestException('Missing Google auth code');
    }

    const { tokens } = await this.googleClient.getToken(dto.code);
    if (!tokens.refresh_token) {
      throw new BadRequestException(
        'Google did not return a refresh_token. Make sure you request offline access and prompt=consent.'
      );
    }

    // Reject up front if the user didn't grant Gmail access. Doing this before
    // any DB write guarantees an un-granted email is never persisted (and so
    // never becomes selectable in a set).
    const grantedScopes = (tokens.scope ?? '').split(' ');
    if (!grantedScopes.includes(REQUIRED_GMAIL_SCOPE)) {
      throw new ForbiddenException(
        "SMSMail needs permission to read and send your Gmail. On Google's consent screen, please check the box granting access to Gmail, then try again.",
      );
    }

    const idToken = tokens.id_token;
    if (!idToken) {
      throw new BadRequestException('Google did not return an id_token with email information');
    }

    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience: this.config.get<string>('GOOGLE_CLIENT_ID'),
    });
    const payload = ticket.getPayload();
    const emailFromGoogle = payload?.email;

    if (!emailFromGoogle) {
      throw new BadRequestException('Could not determine Gmail address from Google token');
    }

    const encrypted = this.encrypt(tokens.refresh_token);

    let email = await this.emailRepo.findOne({
      where: { user: { userId: owner.userId }, email: emailFromGoogle },
      relations: ['user'],
    });

    const isNew = !email;
    // Snapshot prior state so a failed watch can be rolled back cleanly.
    const priorRefreshToken = email?.refreshToken ?? null;
    const priorDeletedAt = email?.deletedAt ?? null;

    if (!email) {
      email = this.emailRepo.create({
        user: owner,
        email: emailFromGoogle,
        refreshToken: encrypted,
        addedAt: new Date(),
        deletedAt: null,
      });
    } else {
      email.refreshToken = encrypted;
      email.deletedAt = null;
    }

    await this.emailRepo.save(email);

    // Scope was validated above, but treat a watch failure (e.g. a residual
    // insufficient-permission error) as an unusable connection: roll the row
    // back so it can't be selected, then surface a clear message.
    let historyId: string;
    let expiry: Date;
    try {
      ({ historyId, expiry } = await this.gmailService.watchGmail(tokens.refresh_token));
    } catch (err) {
      this.logger.error(`Failed to start Gmail watch for ${emailFromGoogle}: ${err}`);
      if (isNew) {
        await this.emailRepo.remove(email);
      } else {
        email.refreshToken = priorRefreshToken;
        email.deletedAt = priorDeletedAt;
        await this.emailRepo.save(email);
      }
      // The DB row is rolled back, but Google still holds the grant from the
      // token exchange above — revoke it so a failed connect leaves nothing
      // dangling in the user's third-party access. Best-effort.
      try {
        await this.gmailService.revokeAccess(tokens.refresh_token);
      } catch (revokeErr) {
        this.logger.error(`Failed to revoke Google access for ${emailFromGoogle}: ${revokeErr}`);
      }
      throw new ForbiddenException(
        "SMSMail couldn't access your Gmail. On Google's consent screen, please check the box granting access to Gmail, then try again.",
      );
    }

    email.lastHistoryId = historyId;
    email.watchExpiry = expiry;
    await this.emailRepo.save(email);

    return {
      emailId: email.emailId,
      email: email.email,
    };
  }

  async listEmailsForUser(userId: number) {
    const emails = await this.emailRepo.find({
      where: { user: { userId }, deletedAt: IsNull() },
      order: { addedAt: 'ASC' },
    });
    return emails.map((e) => ({ emailId: e.emailId, email: e.email, addedAt: e.addedAt }));
  }

  async deleteEmailForUser(
    userId: number,
    emailId: number,
  ): Promise<{ deleted: true; emailId: number }> {
    const email = await this.emailRepo.findOne({
      where: { emailId },
      relations: ['user'],
    });

    if (!email || email.user.userId !== userId) {
      throw new BadRequestException('Email not found for this user');
    }

    if (email.deletedAt) {
      return { deleted: true, emailId: email.emailId };
    }

    // Cascade: tear down any active sets using this email (cancels their
    // Stripe subscriptions and stops the Gmail watch).
    await this.setsService.teardownSetsForEmail(userId, emailId);

    // Stop the Gmail watch and revoke the OAuth grant so the app no longer
    // shows under the user's Google third-party access. Unwatch first — revoking
    // kills the token, so the watch-stop must run while it's still valid. Both
    // are best-effort: a Google failure must never block the local soft-delete.
    if (email.refreshToken) {
      const token = this.decrypt(email.refreshToken);
      try {
        await this.gmailService.unwatchGmail(token);
      } catch (err) {
        this.logger.error(`Failed to unwatch Gmail for email ${emailId}: ${err}`);
      }
      try {
        await this.gmailService.revokeAccess(token);
      } catch (err) {
        this.logger.error(`Failed to revoke Google access for email ${emailId}: ${err}`);
      }
    }

    // Archive the deletion for admin review.
    await this.deletedEmailRepo.save(
      this.deletedEmailRepo.create({
        userId,
        originalEmailId: email.emailId,
        email: email.email,
        createdAt: email.addedAt,
        deletedAt: new Date(),
      }),
    );

    email.refreshToken = null;
    email.deletedAt = new Date();
    await this.emailRepo.save(email);

    return { deleted: true, emailId: email.emailId };
  }

  decrypt(encrypted: string): string {
    const buf = Buffer.from(encrypted, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf-8');
  }

  private encrypt(plain: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }
}

