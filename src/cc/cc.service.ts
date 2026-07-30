import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { User } from '../users/user.entity';

@Injectable()
export class CcService {
  private stripe: Stripe;
  private readonly logger = new Logger(CcService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly config: ConfigService,
  ) {
    const key = this.config.get<string>('STRIPE_TEST_KEY');
    if (!key) throw new Error('STRIPE_TEST_KEY is not set');
    this.stripe = new Stripe(key);
  }

  async attachPaymentMethodForUser(
    userId: number,
    paymentMethodId: string,
  ): Promise<{ stripeCustomerId: string }> {
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) throw new BadRequestException('User not found');

    const email = user.email ?? undefined;
    let customerId = user.stripeCustomerId ?? null;

    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: email || undefined,
        metadata: {
          user_id: String(userId),
        },
      });
      customerId = customer.id;
    }

    try {
      await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
      await this.stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
    } catch (err: any) {
      this.logger.error(`Stripe attach failed: ${err}`);
      throw new BadRequestException(err?.raw?.message ?? 'Failed to save card');
    }

    if (!user.stripeCustomerId) {
      user.stripeCustomerId = customerId;
      await this.userRepo.save(user);
    }

    return { stripeCustomerId: customerId };
  }

  async listPaymentMethodsForUser(userId: number) {
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) throw new BadRequestException('User not found');

    if (!user.stripeCustomerId) return [];

    const { data } = await this.stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: 'card',
    });

    return data.map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand ?? '',
      last4: pm.card?.last4 ?? '',
      expMonth: pm.card?.exp_month ?? 0,
      expYear: pm.card?.exp_year ?? 0,
    }));
  }

  async deletePaymentMethodForUser(
    userId: number,
    paymentMethodId: string,
  ): Promise<{ deleted: string }> {
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) throw new BadRequestException('User not found');

    if (!user.stripeCustomerId) {
      throw new BadRequestException('No saved cards for this user');
    }

    const pm = await this.stripe.paymentMethods.retrieve(paymentMethodId);
    if (pm.customer !== user.stripeCustomerId) {
      throw new BadRequestException('Card does not belong to this user');
    }

    await this.stripe.paymentMethods.detach(paymentMethodId);
    await this.promoteNewDefaultCard(user.stripeCustomerId, paymentMethodId);
    return { deleted: paymentMethodId };
  }

  /**
   * Detaching the customer's default card leaves them with no default, so the
   * next renewal invoice fails and the webhook tears their sets down. If another
   * card is still on file, make it the default. Best-effort: a failure here must
   * not fail the delete the user already asked for.
   */
  private async promoteNewDefaultCard(
    customerId: string,
    detachedPaymentMethodId: string,
  ): Promise<void> {
    try {
      const customer = await this.stripe.customers.retrieve(customerId);
      if (customer.deleted) return;

      const currentDefault = customer.invoice_settings?.default_payment_method;
      const currentDefaultId =
        typeof currentDefault === 'string'
          ? currentDefault
          : (currentDefault?.id ?? null);

      // Stripe may have already cleared it on detach — treat both as "was default".
      if (currentDefaultId && currentDefaultId !== detachedPaymentMethodId) return;

      const { data } = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
        limit: 1,
      });
      if (!data.length) return;

      await this.stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: data[0].id },
      });
    } catch (err) {
      this.logger.error(
        `Failed to promote a new default card for ${customerId}: ${err}`,
      );
    }
  }
}
