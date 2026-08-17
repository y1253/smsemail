import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomInt } from 'node:crypto';
import { Repository, IsNull } from 'typeorm';
import { User } from '../users/user.entity';
import { Phone } from './phone.entity';
import { DeletedPhone } from './deleted-phone.entity';
import { PhoneVerification } from './phone-verification.entity';
import { SignalwireService } from '../signalwire/signalwire.service';
import { SetsService } from '../sets/sets.service';

const CODE_LENGTH = 6;
const CODE_EXPIRY_MINUTES = 10;

@Injectable()
export class PhonesService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Phone)
    private readonly phoneRepo: Repository<Phone>,
    @InjectRepository(DeletedPhone)
    private readonly deletedPhoneRepo: Repository<DeletedPhone>,
    @InjectRepository(PhoneVerification)
    private readonly verificationRepo: Repository<PhoneVerification>,
    private readonly signalwireService: SignalwireService,
    private readonly setsService: SetsService,
  ) {}

  /**
   * Send verification code to the given phone via SignalWire.
   * Stores the code for later verification step.
   */
  async listPhonesForUser(userId: number) {
    const phones = await this.phoneRepo.find({
      where: { user: { userId }, deletedAt: IsNull() },
      order: { addedAt: 'ASC' },
    });
    return phones.map((p) => ({ phoneId: p.phoneId, phone: p.phone, addedAt: p.addedAt }));
  }

  async sendVerificationCode(
    userId: number,
    phone: string,
    consent: boolean,
  ): Promise<{ sent: boolean }> {
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
      consentAt: consent ? new Date() : null,
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
      // Re-verifying is a fresh opt-in: restore, record consent, clear any opt-out.
      existing.deletedAt = null;
      existing.consentAt = valid.consentAt;
      existing.optedOutAt = null;
      await this.phoneRepo.save(existing);
      await this.verificationRepo.delete({ userId, phone });
      return { verified: true, phoneId: existing.phoneId };
    }

    const newPhone = this.phoneRepo.create({
      user,
      phone,
      addedAt: new Date(),
      deletedAt: null,
      consentAt: valid.consentAt,
      optedOutAt: null,
    });
    await this.phoneRepo.save(newPhone);
    await this.verificationRepo.delete({ userId, phone });

    return { verified: true, phoneId: newPhone.phoneId };
  }

  async deletePhoneForUser(
    userId: number,
    phoneId: number,
  ): Promise<{ deleted: true; phoneId: number }> {
    const phone = await this.phoneRepo.findOne({
      where: { phoneId },
      relations: ['user'],
    });

    if (!phone || phone.user.userId !== userId) {
      throw new BadRequestException('Phone not found for this user');
    }

    if (phone.deletedAt) {
      return { deleted: true, phoneId: phone.phoneId };
    }

    // Cascade: tear down any active sets using this phone (cancels their
    // Stripe subscriptions and stops the associated Gmail watch).
    await this.setsService.teardownSetsForPhone(userId, phoneId);

    // Archive the deletion for admin review.
    await this.deletedPhoneRepo.save(
      this.deletedPhoneRepo.create({
        userId,
        originalPhoneId: phone.phoneId,
        phone: phone.phone,
        createdAt: phone.addedAt,
        deletedAt: new Date(),
      }),
    );

    phone.deletedAt = new Date();
    await this.phoneRepo.save(phone);

    return { deleted: true, phoneId: phone.phoneId };
  }

  private generateCode(): string {
    // CSPRNG, not Math.random() — verification codes must be unpredictable.
    // Brute force is additionally bounded by the throttler on /phones/verify
    // and the 10-minute expiry.
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += String(randomInt(0, 10));
    }
    return code;
  }
}
