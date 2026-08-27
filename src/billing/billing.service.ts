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

/** Stripe subscriptions keyed by id, plus why the lookup came back short. */
export type SubscriptionLookup = {
  subs: Map<string, Stripe.Subscription>;
  error: string | null;
};

/** A set's billing state, derived from Stripe rather than the DB. */
export type SubscriptionState = {
  status: 'active' | 'pending_cancel' | 'cancelled';
  /** Next charge date. Null unless the subscription is actively renewing. */
  renewsAt: Date | null;
  /** When service stops. Null unless a cancellation is scheduled. */
  endsAt: Date | null;
  stripeStatus: string | null;
  amount: number | null;
  currency: string | null;
  interval: string | null;
  /**
   * Stripe and `pending_cancel_at` disagree. Happens when a subscription is
   * cancelled or resumed from the Stripe dashboard: that fires
   * `customer.subscription.updated`, which WebhooksService does not handle, so
   * the column is never written.
   */
  dbDrift: boolean;
};

const DEFAULT_INVOICE_LIMIT = 24;
const SUBSCRIPTION_PAGE_SIZE = 100;
const MAX_SUBSCRIPTION_PAGES = 10;

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
  resolveInvoiceSubscriptionId(inv: Stripe.Invoice): string | null {
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

    const { subs } = await this.loadStripeSubscriptions(user.stripeCustomerId);

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
   * DB-only data instead of breaking it — cancel/resume stay usable. `error` is
   * returned rather than thrown so callers can tell "Stripe is down" from "this
   * customer has no subscriptions"; the Billing page ignores it, admin shows it.
   */
  async loadStripeSubscriptions(
    customerId: string | null | undefined,
  ): Promise<SubscriptionLookup> {
    const subs = new Map<string, Stripe.Subscription>();
    if (!customerId) return { subs, error: null };

    try {
      const { data } = await this.stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: SUBSCRIPTION_PAGE_SIZE,
      });
      for (const sub of data) subs.set(sub.id, sub);
    } catch (err: any) {
      this.logger.error(`Stripe subscription list failed: ${err}`);
      return {
        subs,
        error: err?.raw?.message ?? 'Could not load subscriptions from Stripe',
      };
    }

    return { subs, error: null };
  }

  /**
   * Every subscription on the account, keyed by id — one call for the whole
   * admin accounts list rather than one per user (N+1). Pages until Stripe says
   * there is no more, bounded so a growing account can't spin here forever.
   */
  async loadAllStripeSubscriptions(): Promise<SubscriptionLookup> {
    const subs = new Map<string, Stripe.Subscription>();
    let startingAfter: string | undefined;

    try {
      for (let page = 0; page < MAX_SUBSCRIPTION_PAGES; page++) {
        const res = await this.stripe.subscriptions.list({
          status: 'all',
          limit: SUBSCRIPTION_PAGE_SIZE,
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        });
        for (const sub of res.data) subs.set(sub.id, sub);

        if (!res.has_more) return { subs, error: null };
        startingAfter = res.data[res.data.length - 1]?.id;
        if (!startingAfter) return { subs, error: null };
      }
    } catch (err: any) {
      this.logger.error(`Stripe subscription list (all) failed: ${err}`);
      return {
        subs,
        error: err?.raw?.message ?? 'Could not load subscriptions from Stripe',
      };
    }

    // Fell out of the loop with has_more still true — report it rather than
    // letting the tail of the list silently render as "no billing data".
    this.logger.warn(
      `Stripe subscription list truncated at ${subs.size} subscriptions`,
    );
    return { subs, error: null };
  }

  /**
   * The single place a set's billing state is decided, shared by both admin
   * views. Stripe is trusted over the DB: `pending_cancel_at` is only written
   * by our own cancel endpoint, so a cancellation made in the Stripe dashboard
   * leaves the column NULL and the set looking active when it isn't.
   */
  describeSubscription(
    sub: Stripe.Subscription | null,
    set: { deletedAt: Date | null; pendingCancelAt: Date | null },
  ): SubscriptionState {
    const item = sub?.items?.data?.[0] ?? null;
    const price = item?.price ?? null;
    const money = {
      stripeStatus: sub?.status ?? null,
      amount: price?.unit_amount ?? null,
      currency: price?.currency ?? null,
      interval: price?.recurring?.interval ?? null,
    };

    const stripeCancelling = !!(sub?.cancel_at_period_end || sub?.cancel_at);
    // Only meaningful for a live set — a torn-down set legitimately has no
    // pending cancel, and Stripe legitimately reports it as canceled.
    const dbDrift =
      !set.deletedAt && !!sub && stripeCancelling !== !!set.pendingCancelAt;

    // Terminal: the set was torn down, its subscription cancelled outright.
    if (set.deletedAt || sub?.status === 'canceled') {
      return { status: 'cancelled', renewsAt: null, endsAt: null, dbDrift: false, ...money };
    }

    if (stripeCancelling) {
      const ts = sub!.cancel_at ?? item?.current_period_end ?? null;
      return {
        status: 'pending_cancel',
        renewsAt: null,
        endsAt: ts ? new Date(ts * 1000) : set.pendingCancelAt,
        dbDrift,
        ...money,
      };
    }

    // Stripe unreachable (or no subscription at all) — fall back to the DB flag
    // so the page still reflects a cancellation we do know about.
    if (!sub && set.pendingCancelAt) {
      return {
        status: 'pending_cancel',
        renewsAt: null,
        endsAt: set.pendingCancelAt,
        dbDrift: false,
        ...money,
      };
    }

    return {
      status: 'active',
      // A pending-cancel subscription is never billed again, so a renewal date
      // is only ever set on this branch.
      renewsAt: item?.current_period_end
        ? new Date(item.current_period_end * 1000)
        : null,
      endsAt: null,
      dbDrift,
      ...money,
    };
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
