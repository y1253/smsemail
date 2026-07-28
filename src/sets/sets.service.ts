import { BadRequestException, Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
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
    @Inject(forwardRef(() => EmailsService))
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

    await this.teardownSet(set);
    return { deleted: true };
  }

  /**
   * Cancel the set's Stripe subscription, stop the Gmail watch, and soft-delete
   * the set. Errors from Stripe/Gmail are logged but never block the soft-delete.
   * The set must be loaded with its `email` relation.
   */
  private async teardownSet(set: EmailPhoneSet): Promise<void> {
    if (set.stripeSubscriptionId && set.stripeSubscriptionId !== 'PROMO') {
      try {
        await this.stripe.subscriptions.cancel(set.stripeSubscriptionId);
      } catch (err) {
        this.logger.error(`Failed to cancel Stripe subscription ${set.stripeSubscriptionId}: ${err}`);
      }
    }

    if (set.email?.refreshToken) {
      try {
        const refreshToken = this.emailsService.decrypt(set.email.refreshToken);
        await this.gmailService.unwatchGmail(refreshToken);
      } catch (err) {
        this.logger.error(`Failed to unwatch Gmail for set ${set.setId}: ${err}`);
      }
    }

    set.deletedAt = new Date();
    set.pendingCancelAt = null;
    await this.setRepo.save(set);
  }

  /**
   * Tear down every active set that uses the given email (owned by userId).
   * Returns the number of sets torn down.
   */
  async teardownSetsForEmail(userId: number, emailId: number): Promise<number> {
    const sets = await this.setRepo.find({
      where: { email: { emailId, user: { userId } }, deletedAt: IsNull() },
      relations: ['email', 'email.user', 'phone'],
    });
    for (const set of sets) {
      await this.teardownSet(set);
    }
    return sets.length;
  }

  /**
   * Tear down every active set that uses the given phone (owned by userId).
   * Returns the number of sets torn down.
   */
  async teardownSetsForPhone(userId: number, phoneId: number): Promise<number> {
    const sets = await this.setRepo.find({
      where: { phone: { phoneId }, email: { user: { userId } }, deletedAt: IsNull() },
      relations: ['email', 'email.user', 'phone'],
    });
    for (const set of sets) {
      await this.teardownSet(set);
    }
    return sets.length;
  }

  /**
   * Case-insensitive (and whitespace-tolerant) match against the single shared
   * PROMO_CODE secret. An unset/empty PROMO_CODE never matches.
   */
  private isPromoValid(promoCode?: string): boolean {
    const validPromo = this.config.get<string>('PROMO_CODE');
    if (!validPromo || !promoCode) return false;
    return promoCode.trim().toLowerCase() === validPromo.trim().toLowerCase();
  }

  validatePromo(promoCode: string): { valid: boolean } {
    return { valid: this.isPromoValid(promoCode) };
  }

  /**
   * When the subscription is scheduled to end (or, once resumed, when it next
   * renews). Stripe 20.x moved `current_period_end` off the Subscription and
   * onto its items, so reading it from the subscription itself yields an
   * Invalid Date. `cancel_at` is the authoritative "service ends here" stamp
   * once `cancel_at_period_end` is set; the item period is the fallback.
   */
  private resolveCancelAt(sub: Stripe.Subscription): Date | null {
    const ts = sub.cancel_at ?? sub.items?.data?.[0]?.current_period_end ?? null;
    return ts ? new Date(ts * 1000) : null;
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

    const promoValid = this.isPromoValid(promoCode);

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
        existing.pendingCancelAt = null;
        existing.createdAt = now;
        existing.stripeSubscriptionId = subscriptionId;
        await this.setRepo.save(existing);
        await this.refreshGmailWatch(email);
        await this.signalwireService.sendSms(
          phone.phone,
          "SMSMail: You're subscribed to email-to-SMS alerts. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to unsubscribe.",
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

  async cancelSetSubscription(userId: number, setId: number): Promise<{ cancelAt: Date | null }> {
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
    set.pendingCancelAt = this.resolveCancelAt(sub);
    await this.setRepo.save(set);
    return { cancelAt: set.pendingCancelAt };
  }

  /**
   * Undo a pending cancellation while the set is still alive. Stripe keeps the
   * same subscription and billing anchor, so the user is simply charged again
   * on the date the subscription would otherwise have ended — no immediate
   * charge and no proration.
   */
  async resumeSetSubscription(
    userId: number,
    setId: number,
  ): Promise<{ resumed: true; nextBillingAt: Date | null }> {
    const set = await this.setRepo.findOne({
      where: { setId, deletedAt: IsNull() },
      relations: ['email', 'email.user'],
    });
    if (!set || set.email.user.userId !== userId) {
      throw new BadRequestException('Set not found for this user');
    }
    if (!set.stripeSubscriptionId || set.stripeSubscriptionId === 'PROMO') {
      throw new BadRequestException('No paid subscription to resume');
    }
    if (!set.pendingCancelAt) {
      throw new BadRequestException('Subscription is not scheduled for cancellation');
    }

    // Resuming with no card on file would silently succeed here and then fail
    // at the next invoice, which tears the set down. Catch it now instead.
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user?.stripeCustomerId) {
      throw new BadRequestException('Add a payment method before resuming');
    }
    const { data: cards } = await this.stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: 'card',
      limit: 1,
    });
    if (cards.length === 0) {
      throw new BadRequestException('Add a payment method before resuming');
    }

    let sub: Stripe.Subscription;
    try {
      sub = await this.stripe.subscriptions.update(set.stripeSubscriptionId, {
        cancel_at_period_end: false,
      });
    } catch (err: any) {
      this.logger.error(`Stripe resume failed for ${set.stripeSubscriptionId}: ${err}`);
      throw new BadRequestException(
        'This subscription has already ended — create the set again to restart it',
      );
    }

    set.pendingCancelAt = null;
    await this.setRepo.save(set);
    return { resumed: true, nextBillingAt: this.resolveCancelAt(sub) };
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
    if (!email.refreshToken) return;
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

