import {
  ConflictException,
  Inject,
  Injectable,
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

  async getUser({ user_id }: { user_id: number }) {
    const user = await this.userRepo.findOneBy({ userId: user_id });
    return { ...user };
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

  async login(user: { email: string; password: string }) {
    const savedUser = await this.getUserByEmail(user.email);
    if (!savedUser) {
      throw new UnauthorizedException('Invalid password or email');
    }

    if (!(await bcrypt.compare(user.password, savedUser.password))) {
      throw new UnauthorizedException('Invalid password or email');
    }

    return await this.createToken({
      userId: savedUser.userId,
      email: savedUser.email,
    });
  }

  async googleLogin(credential: string) {
    const ticket = await this.googleClient.verifyIdToken({
      idToken: credential,
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
    }

    const accessToken = await this.createToken({
      userId: user.userId,
      email: user.email,
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

