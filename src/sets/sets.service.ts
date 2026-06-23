import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { User } from '../users/user.entity';
import { Email } from '../emails/email.entity';
import { Phone } from '../phones/phone.entity';
import { EmailPhoneSet } from './email-phone-set.entity';
import { SetAllowedSender } from './set-allowed-sender.entity';
import { EmailsService } from '../emails/emails.service';
import { GmailService } from '../gmail/gmail.service';
import { SignalwireService } from '../signalwire/signalwire.service';

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
    @InjectRepository(SetAllowedSender)
    private readonly senderRepo: Repository<SetAllowedSender>,
    private readonly config: ConfigService,
    private readonly emailsService: EmailsService,
    private readonly gmailService: GmailService,
    private readonly signalwireService: SignalwireService,
  ) {
    const key = this.config.get<string>('STRIPE_TEST_KEY');
    if (!key) throw new Error('STRIPE_TEST_KEY is not set');
    this.stripe = new Stripe(key);
  }

  async listSetsForUser(userId: number) {
    const sets = await this.setRepo.find({
      where: { email: { user: { userId } }, deletedAt: IsNull() },
      relations: ['email', 'phone', 'allowedSenders'],
      order: { createdAt: 'ASC' },
    });
    return sets.map((s) => ({
      setId: s.setId,
      createdAt: s.createdAt,
      pendingCancelAt: s.pendingCancelAt,
      email: { emailId: s.email.emailId, email: s.email.email },
      phone: { phoneId: s.phone.phoneId, phone: s.phone.phone },
      allowedSenders: (s.allowedSenders ?? []).map((a) => a.email),
      stripeSubscriptionId: s.stripeSubscriptionId,
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

    if (set.stripeSubscriptionId && set.stripeSubscriptionId !== 'PROMO') {
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
      if (!priceId) throw new BadRequestException('Billing is not configured (STRIPE_PRICE_ID missing)');

      try {
        const subscription = await this.stripe.subscriptions.create({
          customer: user.stripeCustomerId!,
          items: [{ price: priceId }],
        });
        subscriptionId = subscription.id;
      } catch (err: any) {
        this.logger.error(`Stripe subscription create failed: ${err}`);
        throw new BadRequestException(err?.raw?.message ?? 'Failed to start subscription — check your payment method');
      }
    }

    if (existing) {
      if (existing.deletedAt) {
        existing.deletedAt = null;
        existing.createdAt = now;
        existing.stripeSubscriptionId = subscriptionId;
        await this.setRepo.save(existing);
        await this.refreshGmailWatch(email);
        await this.signalwireService.sendSms(
          phone.phone,
          'Welcome! Your emails will be forwarded here as SMS summaries.\nText HELP anytime to see available commands.',
        );
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
    await this.refreshGmailWatch(email);
    await this.signalwireService.sendSms(
      phone.phone,
      'Welcome! Your emails will be forwarded here as SMS summaries.\nText HELP anytime to see available commands.',
    );
    return { setId: saved.setId };
  }

  async cancelSetSubscription(userId: number, setId: number): Promise<{ cancelAt: Date }> {
    const set = await this.setRepo.findOne({
      where: { setId, deletedAt: IsNull() },
      relations: ['email', 'email.user'],
    });
    if (!set || set.email.user.userId !== userId) {
      throw new BadRequestException('Set not found for this user');
    }
    if (!set.stripeSubscriptionId || set.stripeSubscriptionId === 'PROMO') {
      throw new BadRequestException('No paid subscription to cancel');
    }
    if (set.pendingCancelAt) {
      throw new BadRequestException('Subscription is already scheduled for cancellation');
    }
    const sub = await this.stripe.subscriptions.update(set.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
    set.pendingCancelAt = new Date((sub as any).current_period_end * 1000);
    await this.setRepo.save(set);
    return { cancelAt: set.pendingCancelAt };
  }

  async updateSenders(userId: number, setId: number, senders: string[]): Promise<{ updated: true }> {
    const set = await this.setRepo.findOne({
      where: { setId, deletedAt: IsNull() },
      relations: ['email', 'email.user'],
    });
    if (!set || set.email.user.userId !== userId) {
      throw new BadRequestException('Set not found for this user');
    }
    await this.senderRepo.delete({ set: { setId } });
    if (senders.length > 0) {
      const rows = senders.map((email) =>
        this.senderRepo.create({ set, email: email.toLowerCase().trim() }),
      );
      await this.senderRepo.save(rows);
    }
    return { updated: true };
  }

  private async refreshGmailWatch(email: Email): Promise<void> {
    try {
      const refreshToken = this.emailsService.decrypt(email.refreshToken);
      const { historyId, expiry } = await this.gmailService.watchGmail(refreshToken);
      email.lastHistoryId = historyId;
      email.watchExpiry = expiry;
      await this.emailRepo.save(email);
    } catch (err) {
      this.logger.error(`Failed to re-watch Gmail for email ${email.emailId}: ${err}`);
    }
  }
}

