import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cc } from './cc.entity';
import { User } from '../users/user.entity';

@Injectable()
export class CcService {
  constructor(
    @InjectRepository(Cc)
    private readonly ccRepo: Repository<Cc>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async createForUser(userId: number, cc: string): Promise<Cc> {
    const user = await this.userRepo.findOne({
      where: { userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const now = new Date();

    const entity = this.ccRepo.create({
      user,
      cc,
      addedAt: now,
      deletedAt: null,
    });

    return this.ccRepo.save(entity);
  }
}

