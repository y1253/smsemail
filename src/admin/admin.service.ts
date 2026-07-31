import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { EmailPhoneSet } from '../sets/email-phone-set.entity';
import { DeletedEmail } from '../emails/deleted-email.entity';
import { DeletedPhone } from '../phones/deleted-phone.entity';
import { BillingService, type BillingInvoice } from '../billing/billing.service';

/** The admin card is unpaginated; 100 is the max the Stripe list DTO allows. */
const ADMIN_INVOICE_LIMIT = 100;

type BillingState = { promo: boolean; renewsAt: Date | null; endsAt: Date | null };

/**
 * The account's next charge: the soonest renewal across its paying sets. Promo
 * sets are free and pending-cancel sets are never billed again, so neither has
 * a `renewsAt` to contribute. Mirrors the user-facing BillingSummary tile.
 */
function earliestRenewal(sets: BillingState[]): Date | null {
  const dates = sets
    .filter((s) => !s.promo)
    .map((s) => s.renewsAt)
    .filter((d): d is Date => !!d);
  return dates.length ? new Date(Math.min(...dates.map((d) => +d))) : null;
}

/** The soonest date service stops on a set that is scheduled to cancel. */
function earliestEnd(sets: BillingState[]): Date | null {
  const dates = sets.map((s) => s.endsAt).filter((d): d is Date => !!d);
  return dates.length ? new Date(Math.min(...dates.map((d) => +d))) : null;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(EmailPhoneSet)
    private readonly setRepo: Repository<EmailPhoneSet>,
    @InjectRepository(DeletedEmail)
    private readonly deletedEmailRepo: Repository<DeletedEmail>,
    @InjectRepository(DeletedPhone)
    private readonly deletedPhoneRepo: Repository<DeletedPhone>,
    private readonly billingService: BillingService,
  ) {}

  async getDeletedContacts() {
    const [emails, phones] = await Promise.all([
      this.deletedEmailRepo.find({ order: { deletedAt: 'DESC' } }),
      this.deletedPhoneRepo.find({ order: { deletedAt: 'DESC' } }),
    ]);
    return {
      emails: emails.map((e) => ({
        userId: e.userId,
        value: e.email,
        originalId: e.originalEmailId,
        createdAt: e.createdAt,
        deletedAt: e.deletedAt,
      })),
      phones: phones.map((p) => ({
        userId: p.userId,
        value: p.phone,
        originalId: p.originalPhoneId,
        createdAt: p.createdAt,
        deletedAt: p.deletedAt,
      })),
    };
  }

  async getAllAccounts() {
    const users = await this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.emails', 'email', 'email.deleted_at IS NULL')
      .leftJoinAndSelect('user.phones', 'phone', 'phone.deleted_at IS NULL')
      .orderBy('user.create_at', 'DESC')
      .getMany();

    // Live sets grouped by user. Previously a COUNT, but the billing column
    // needs each set's subscription id, and the table is small enough to read.
    const liveSets = await this.setRepo
      .createQueryBuilder('set')
      .innerJoin('set.email', 'email')
      .select('email.user_id', 'userId')
      .addSelect('set.set_id', 'setId')
      .addSelect('set.stripe_subscription_id', 'stripeSubscriptionId')
      .addSelect('set.pending_cancel_at', 'pendingCancelAt')
      .where('set.deleted_at IS NULL')
      .getRawMany<{
        userId: number;
        setId: number;
        stripeSubscriptionId: string | null;
        pendingCancelAt: Date | null;
      }>();

    const setsByUser = new Map<number, typeof liveSets>();
    for (const row of liveSets) {
      const key = Number(row.userId);
      const list = setsByUser.get(key);
      if (list) list.push(row);
      else setsByUser.set(key, [row]);
    }

    // One Stripe call for the whole page — per-user lookups would be N+1.
    const { subs, error: subscriptionsError } =
      await this.billingService.loadAllStripeSubscriptions();

    return users.map((u) => {
      const mine = setsByUser.get(u.userId) ?? [];
      const states = mine.map((row) => {
        const promo = row.stripeSubscriptionId === 'PROMO';
        const sub =
          !promo && row.stripeSubscriptionId
            ? (subs.get(row.stripeSubscriptionId) ?? null)
            : null;
        return {
          promo,
          ...this.billingService.describeSubscription(sub, {
            deletedAt: null,
            pendingCancelAt: row.pendingCancelAt,
          }),
        };
      });

      return {
        userId: u.userId,
        name: [u.firstName, u.lastName].filter(Boolean).join(' ') || '—',
        email: u.email,
        authType: u.authType,
        createdAt: u.createdAt,
        active: u.active,
        setCount: mine.length,
        nextRenewalAt: earliestRenewal(states),
        pendingCancelAt: earliestEnd(states),
        pendingCancelCount: states.filter((s) => s.status === 'pending_cancel')
          .length,
        promoCount: states.filter((s) => s.promo).length,
        subscriptionsError,
        emails: u.emails.map((e) => e.email),
        phones: u.phones.map((p) => p.phone),
      };
    });
  }

  async getAccountDetail(userId: number) {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.emails', 'email')
      .leftJoinAndSelect('user.phones', 'phone')
      .where('user.user_id = :userId', { userId })
      .getOne();

    if (!user) {
      throw new NotFoundException('Account not found');
    }

    const sets = await this.setRepo
      .createQueryBuilder('set')
      .leftJoinAndSelect('set.email', 'email')
      .leftJoinAndSelect('set.phone', 'phone')
      .where('email.user_id = :userId', { userId })
      .orderBy('set.created_at', 'DESC')
      .getMany();

    const [{ transactions, transactionsError }, { subs, error: subsError }] =
      await Promise.all([
        this.loadTransactions(userId),
        this.billingService.loadStripeSubscriptions(user.stripeCustomerId),
      ]);

    const mappedSets = sets.map((s) => {
      const promo = s.stripeSubscriptionId === 'PROMO';
      // Promo sets have no Stripe object at all — never look one up.
      const sub =
        !promo && s.stripeSubscriptionId
          ? (subs.get(s.stripeSubscriptionId) ?? null)
          : null;
      const state = this.billingService.describeSubscription(sub, s);

      return {
        setId: s.setId,
        createdAt: s.createdAt,
        deletedAt: s.deletedAt,
        stripeSubscriptionId: s.stripeSubscriptionId,
        pendingCancelAt: s.pendingCancelAt,
        email: s.email?.email ?? null,
        phone: s.phone?.phone ?? null,
        promo,
        ...state,
        // A promo set is free and has no Stripe price to read money off.
        amount: promo ? 0 : state.amount,
        currency: promo ? null : state.currency,
        interval: promo ? null : state.interval,
      };
    });

    const nextRenewalAt = earliestRenewal(mappedSets);

    return {
      userId: user.userId,
      name: [user.firstName, user.lastName].filter(Boolean).join(' ') || '—',
      email: user.email,
      authType: user.authType,
      createdAt: user.createdAt,
      active: user.active,
      stripeCustomerId: user.stripeCustomerId,
      emails: user.emails.map((e) => ({
        email: e.email,
        addedAt: e.addedAt,
        deletedAt: e.deletedAt,
      })),
      phones: user.phones.map((p) => ({
        phone: p.phone,
        addedAt: p.addedAt,
        deletedAt: p.deletedAt,
      })),
      sets: mappedSets,
      setCounts: {
        total: mappedSets.length,
        active: mappedSets.filter((s) => s.status !== 'cancelled').length,
      },
      nextRenewalAt,
      transactions,
      transactionsError,
      subscriptionsError: subsError,
    };
  }

  /**
   * Transaction history comes live from Stripe via BillingService — the same
   * source the user's own Billing page reads. The `transaction` table is never
   * written to, so querying it showed "no transactions" for every account.
   *
   * A Stripe failure must not take down the whole account page, so it degrades
   * to an empty list plus a message. An empty list with no message is the
   * genuine "no charges yet" case (users without a stripeCustomerId land here).
   */
  private async loadTransactions(userId: number): Promise<{
    transactions: BillingInvoice[];
    transactionsError: string | null;
  }> {
    try {
      const page = await this.billingService.listInvoicesForUser(userId, {
        limit: ADMIN_INVOICE_LIMIT,
      });
      return { transactions: page.data, transactionsError: null };
    } catch (err: any) {
      this.logger.error(`Stripe invoice list failed for user ${userId}: ${err}`);
      return {
        transactions: [],
        transactionsError:
          err?.response?.message ?? 'Could not load transactions from Stripe',
      };
    }
  }
}
