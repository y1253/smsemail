import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Email } from '../emails/email.entity';
import { Phone } from '../phones/phone.entity';
import { EmailPhoneSet } from './email-phone-set.entity';

@Injectable()
export class SetsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Email)
    private readonly emailRepo: Repository<Email>,
    @InjectRepository(Phone)
    private readonly phoneRepo: Repository<Phone>,
    @InjectRepository(EmailPhoneSet)
    private readonly setRepo: Repository<EmailPhoneSet>,
  ) {}

  async createSetForUser(
    userId: number,
    emailId: number,
    phoneId: number,
  ): Promise<{ setId: number }> {
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const email = await this.emailRepo.findOne({
      where: { emailId, user: { userId } },
      relations: ['user'],
    });
    if (!email) {
      throw new BadRequestException('Email not found for this user');
    }

    const phone = await this.phoneRepo.findOne({
      where: { phoneId, user: { userId } },
      relations: ['user'],
    });
    if (!phone) {
      throw new BadRequestException('Phone not found for this user');
    }

    const now = new Date();

    const existing = await this.setRepo.findOne({
      where: { email: { emailId }, phone: { phoneId } },
      relations: ['email', 'phone'],
    });

    if (existing) {
      if (existing.deletedAt) {
        existing.deletedAt = null;
        existing.createdAt = now;
        await this.setRepo.save(existing);
        return { setId: existing.setId };
      }
      throw new BadRequestException('Set already exists for this email and phone');
    }

    const set = this.setRepo.create({
      email,
      phone,
      createdAt: now,
      deletedAt: null,
    });

    const saved = await this.setRepo.save(set);
    return { setId: saved.setId };
  }
}

