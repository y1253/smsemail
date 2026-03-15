import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Email } from './email.entity';
import { User } from '../users/user.entity';
import { ConnectGoogleEmailDto } from './dto/connect-google-email.dto';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';

type JwtPayload = {
  user_id: number;
  email: string;
};

@Injectable()
export class EmailsService {
  private readonly encryptionKey: Buffer;

  constructor(
    @InjectRepository(Email)
    private readonly emailRepo: Repository<Email>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly config: ConfigService,
    @Inject('GOOGLE_CLIENT')
    private readonly googleClient: OAuth2Client,
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

    return {
      emailId: email.emailId,
      email: email.email,
    };
  }

  private encrypt(plain: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }
}

