import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { User } from '../users/user.entity';
import { Email } from '../emails/email.entity';
import { Phone } from '../phones/phone.entity';
import { EmailPhoneSet } from './email-phone-set.entity';
import { EmailsService } from '../emails/emails.service';
import { GmailService } from '../gmail/gmail.service';

@Injectable()
export class SetsService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(SetsService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Email)
    private readonly emailRepo: Repository<Email>,
    @InjectRepository(Phone)
    private readonly phoneRepo: Repository<Phone>,
    @InjectRepository(EmailPhoneSet)
    private readonly setRepo: Repository<EmailPhoneSet>,
    private readonly config: ConfigService,
    private readonly emailsService: EmailsService,
    private readonly gmailService: GmailService,
  ) {
    const key = this.config.get<string>('STRIPE_TEST_KEY');
    if (!key) throw new Error('STRIPE_TEST_KEY is not set');
    this.stripe = new Stripe(key);
  }

  async listSetsForUser(userId: number) {
    const sets = await this.setRepo.find({
      where: { email: { user: { userId } }, deletedAt: IsNull() },
      relations: ['email', 'phone'],
      order: { createdAt: 'ASC' },
    });
    return sets.map((s) => ({
      setId: s.setId,
      createdAt: s.createdAt,
      email: { emailId: s.email.emailId, email: s.email.email },
      phone: { phoneId: s.phone.phoneId, phone: s.phone.phone },
    }));
  }

  async deleteSetForUser(userId: number, setId: number): Promise<{ deleted: true }> {
    const set = await this.setRepo.findOne({
      where: { setId, deletedAt: IsNull() },
      relations: ['email', 'email.user', 'phone'],
    });

    if (!set || set.email.user.userId !== userId) {
      throw new BadRequestException('Set not found for this user');
    }

    if (set.stripeSubscriptionId) {
      try {
        await this.stripe.subscriptions.cancel(set.stripeSubscriptionId);
      } catch (err) {
        this.logger.error(`Failed to cancel Stripe subscription ${set.stripeSubscriptionId}: ${err}`);
      }
    }

    try {
      const refreshToken = this.emailsService.decrypt(set.email.refreshToken);
      await this.gmailService.unwatchGmail(refreshToken);
    } catch (err) {
      this.logger.error(`Failed to unwatch Gmail for set ${setId}: ${err}`);
    }

    set.deletedAt = new Date();
    await this.setRepo.save(set);
    return { deleted: true };
  }

  async createSetForUser(
    userId: number,
    emailId: number,
    phoneId: number,
    promoCode?: string,
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

    const validPromo = this.config.get<string>('PROMO_CODE');
    const promoValid = !!promoCode && promoCode === validPromo;

    if (!promoValid && !user.stripeCustomerId) {
      throw new BadRequestException('Add a payment method before creating a set');
    }

    const now = new Date();

    const existing = await this.setRepo.findOne({
      where: { email: { emailId }, phone: { phoneId } },
      relations: ['email', 'phone'],
    });

    let subscriptionId: string;

    if (promoValid) {
      subscriptionId = 'PROMO';
    } else {
      const priceId = this.config.get<string>('STRIPE_PRICE_ID');
      if (!priceId) throw new Error('STRIPE_PRICE_ID is not set');

      const subscription = await this.stripe.subscriptions.create({
        customer: user.stripeCustomerId!,
        items: [{ price: priceId }],
      });
      subscriptionId = subscription.id;
    }

    if (existing) {
      if (existing.deletedAt) {
        existing.deletedAt = null;
        existing.createdAt = now;
        existing.stripeSubscriptionId = subscriptionId;
        await this.setRepo.save(existing);
        return { setId: existing.setId };
      }
      if (!promoValid) {
        await this.stripe.subscriptions.cancel(subscriptionId);
      }
      throw new BadRequestException('Set already exists for this email and phone');
    }

    const set = this.setRepo.create({
      email,
      phone,
      createdAt: now,
      deletedAt: null,
      stripeSubscriptionId: subscriptionId,
    });

    const saved = await this.setRepo.save(set);
    return { setId: saved.setId };
  }
}

