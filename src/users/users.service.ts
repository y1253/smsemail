import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './user.entity';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcrypt';

type JwtPayload = {
  user_id: number;
  email: string;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    @Inject('GOOGLE_CLIENT')
    private readonly googleClient: OAuth2Client,
  ) { }

  async getProfile(userId: number) {
    const user = await this.userRepo.findOne({
      where: { userId },
      select: ['userId', 'firstName', 'lastName', 'email'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
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

