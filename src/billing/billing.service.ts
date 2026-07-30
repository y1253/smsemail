import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import Stripe from 'stripe';
import { User } from '../users/user.entity';
import { EmailPhoneSet } from '../sets/email-phone-set.entity';
import { ListInvoicesDto } from './dto/list-invoices.dto';

/** One Stripe invoice, flattened for the client. Amounts stay in minor units. */
export type BillingInvoice = {
  id: string;
  number: string | null;
  status: string;
  amount: number;
  currency: string;
  created: Date;
  paidAt: Date | null;
  description: string | null;
  subscriptionId: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
};

export type InvoicePage = {
  data: BillingInvoice[];
  hasMore: boolean;
  nextCursor: string | null;
};

/** A set, plus whatever Stripe knows about the subscription behind it. */
export type BillingSubscription = {
  setId: number;
  email: string;
  phone: string;
  createdAt: Date;
  status: 'active' | 'pending_cancel';
  promo: boolean;
  stripeSubscriptionId: string | null;
  pendingCancelAt: Date | null;
  currentPeriodEnd: Date | null;
  stripeStatus: string | null;
  amount: number | null;
  currency: string | null;
  interval: string | null;
};

const DEFAULT_INVOICE_LIMIT = 24;

@Injectable()
export class BillingService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(EmailPhoneSet)
    private readonly setRepo: Repository<EmailPhoneSet>,
    private readonly config: ConfigService,
  ) {
    const key = this.config.get<string>('STRIPE_TEST_KEY');
    if (!key) throw new Error('STRIPE_TEST_KEY is not set');
    this.stripe = new Stripe(key);
  }

  /**
   * Transaction history comes straight from Stripe: nothing in this codebase
   * ever writes to the `transaction` table, so reading it would always be empty.
   */
  async listInvoicesForUser(
    userId: number,
    dto: ListInvoicesDto,
  ): Promise<InvoicePage> {
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) throw new BadRequestException('User not found');

    // Every user is in this state before their first card — not an error.
    if (!user.stripeCustomerId) {
      return { data: [], hasMore: false, nextCursor: null };
    }

    let page: Stripe.ApiList<Stripe.Invoice>;
    try {
      page = await this.stripe.invoices.list({
        customer: user.stripeCustomerId,
        limit: dto.limit ?? DEFAULT_INVOICE_LIMIT,
        ...(dto.startingAfter ? { starting_after: dto.startingAfter } : {}),
      });
    } catch (err: any) {
      this.logger.error(`Stripe invoice list failed: ${err}`);
      throw new BadRequestException(
        err?.raw?.message ?? 'Could not load transactions',
      );
    }

    const data = page.data.map((inv) => this.toBillingInvoice(inv));

    return {
      data,
      hasMore: page.has_more,
      nextCursor: page.has_more ? (data[data.length - 1]?.id ?? null) : null,
    };
  }

  private toBillingInvoice(inv: Stripe.Invoice): BillingInvoice {
    const status = inv.status ?? 'draft';
    const paidAt = inv.status_transitions?.paid_at ?? null;

    return {
      id: inv.id ?? '',
      number: inv.number ?? null,
      status,
      // Both are minor units. Formatting is the client's job.
      amount: status === 'paid' ? inv.amount_paid : inv.amount_due,
      currency: inv.currency,
      created: new Date(inv.created * 1000),
      paidAt: paidAt ? new Date(paidAt * 1000) : null,
      description: inv.lines?.data?.[0]?.description ?? null,
      subscriptionId: this.resolveInvoiceSubscriptionId(inv),
      // Both are null while the invoice is still a draft.
      hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
      invoicePdf: inv.invoice_pdf ?? null,
    };
  }

  /**
   * Stripe 20.x removed `Invoice.subscription` in favour of
   * `parent.subscription_details.subscription`. Fall back to the legacy field so
   * invoices written under an older API version still resolve.
   */
  private resolveInvoiceSubscriptionId(inv: Stripe.Invoice): string | null {
    const fromParent = inv.parent?.subscription_details?.subscription;
    const raw = fromParent ?? (inv as any).subscription ?? null;
    if (!raw) return null;
    return typeof raw === 'string' ? raw : (raw.id ?? null);
  }

  /**
   * Active subscriptions = the user's live sets, enriched with the Stripe
   * subscription behind each. Soft-deleted sets are excluded.
   */
  async listSubscriptionsForUser(
    userId: number,
  ): Promise<BillingSubscription[]> {
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) throw new BadRequestException('User not found');

    const sets = await this.setRepo.find({
      where: { email: { user: { userId } }, deletedAt: IsNull() },
      relations: ['email', 'phone'],
      order: { createdAt: 'ASC' },
    });

    const subs = await this.loadStripeSubscriptions(user.stripeCustomerId);

    return sets.map((s) => {
      const promo = s.stripeSubscriptionId === 'PROMO';
      const sub =
        !promo && s.stripeSubscriptionId
          ? (subs.get(s.stripeSubscriptionId) ?? null)
          : null;
      const item = sub?.items?.data?.[0] ?? null;
      const price = item?.price ?? null;

      return {
        setId: s.setId,
        email: s.email.email,
        phone: s.phone.phone,
        createdAt: s.createdAt,
        // Same derivation as admin.service, minus 'cancelled' — soft-deleted
        // sets never reach here.
        status: s.pendingCancelAt ? 'pending_cancel' : 'active',
        promo,
        stripeSubscriptionId: s.stripeSubscriptionId,
        pendingCancelAt: s.pendingCancelAt,
        currentPeriodEnd: this.resolvePeriodEnd(sub, s.pendingCancelAt),
        stripeStatus: sub?.status ?? null,
        amount: promo ? 0 : (price?.unit_amount ?? null),
        currency: promo ? null : (price?.currency ?? null),
        interval: promo ? null : (price?.recurring?.interval ?? null),
      };
    });
  }

  /**
   * One list call rather than N retrieves. A Stripe outage degrades the page to
   * DB-only data instead of breaking it — cancel/resume stay usable.
   */
  private async loadStripeSubscriptions(
    customerId: string | null | undefined,
  ): Promise<Map<string, Stripe.Subscription>> {
    const map = new Map<string, Stripe.Subscription>();
    if (!customerId) return map;

    try {
      const { data } = await this.stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 100,
      });
      for (const sub of data) map.set(sub.id, sub);
    } catch (err) {
      this.logger.error(`Stripe subscription list failed: ${err}`);
    }

    return map;
  }

  /**
   * Stripe 20.x moved `current_period_end` onto the subscription's items, so
   * reading it off the subscription yields an Invalid Date. Once a cancel is
   * pending, `cancel_at` is the authoritative "service ends here" stamp — this
   * mirrors `SetsService.resolveCancelAt`. Falls back to the set's stored
   * `pendingCancelAt` when Stripe is unreachable.
   */
  private resolvePeriodEnd(
    sub: Stripe.Subscription | null,
    pendingCancelAt: Date | null,
  ): Date | null {
    if (!sub) return pendingCancelAt;
    const ts = sub.cancel_at ?? sub.items?.data?.[0]?.current_period_end ?? null;
    return ts ? new Date(ts * 1000) : pendingCancelAt;
  }
}
