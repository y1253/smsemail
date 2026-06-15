import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async getAllAccounts() {
    const users = await this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.emails', 'email', 'email.deleted_at IS NULL')
      .leftJoinAndSelect('user.phones', 'phone', 'phone.deleted_at IS NULL')
      .orderBy('user.create_at', 'DESC')
      .getMany();

    return users.map((u) => ({
      userId: u.userId,
      name: [u.firstName, u.lastName].filter(Boolean).join(' ') || '—',
      email: u.email,
      authType: u.authType,
      createdAt: u.createdAt,
      emails: u.emails.map((e) => e.email),
      phones: u.phones.map((p) => p.phone),
    }));
  }
}
