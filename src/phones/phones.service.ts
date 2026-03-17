import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Phone } from './phone.entity';
import { PhoneVerification } from './phone-verification.entity';
import { SignalwireService } from '../signalwire/signalwire.service';

const CODE_LENGTH = 6;
const CODE_EXPIRY_MINUTES = 10;

@Injectable()
export class PhonesService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Phone)
    private readonly phoneRepo: Repository<Phone>,
    @InjectRepository(PhoneVerification)
    private readonly verificationRepo: Repository<PhoneVerification>,
    private readonly signalwireService: SignalwireService,
  ) {}

  /**
   * Send verification code to the given phone via SignalWire.
   * Stores the code for later verification step.
   */
  async sendVerificationCode(userId: number, phone: string): Promise<{ sent: boolean }> {
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const code = this.generateCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + CODE_EXPIRY_MINUTES);

    const verification = this.verificationRepo.create({
      userId,
      phone,
      code,
      expiresAt,
    });
    await this.verificationRepo.save(verification);

    const body = `Your verification code is: ${code}. It expires in ${CODE_EXPIRY_MINUTES} minutes.`;
    await this.signalwireService.sendSms(phone, body);

    return { sent: true };
  }

  /**
   * Verify the code for the given phone. If it matches and is not expired,
   * add the phone to the user's phones in the phone table.
   */
  async verifyCode(
    userId: number,
    phone: string,
    code: string,
  ): Promise<{ verified: true; phoneId: number }> {
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const now = new Date();
    const valid = await this.verificationRepo.findOne({
      where: { userId, phone, code },
    });
    if (!valid) {
      throw new BadRequestException('Invalid code');
    }
    if (valid.expiresAt < now) {
      throw new BadRequestException('Code has expired');
    }

    let existing = await this.phoneRepo.findOne({
      where: { user: { userId }, phone },
      relations: ['user'],
    });
    if (existing) {
      if (existing.deletedAt) {
        existing.deletedAt = null;
        await this.phoneRepo.save(existing);
      }
      await this.verificationRepo.delete({ userId, phone });
      return { verified: true, phoneId: existing.phoneId };
    }

    const newPhone = this.phoneRepo.create({
      user,
      phone,
      addedAt: new Date(),
      deletedAt: null,
    });
    await this.phoneRepo.save(newPhone);
    await this.verificationRepo.delete({ userId, phone });

    return { verified: true, phoneId: newPhone.phoneId };
  }

  private generateCode(): string {
    const digits = '0123456789';
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += digits[Math.floor(Math.random() * digits.length)];
    }
    return code;
  }
}
