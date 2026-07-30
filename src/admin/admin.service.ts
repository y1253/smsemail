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

    // Active-set counts per user in a single grouped query (avoids N+1).
    const setCountRows = await this.setRepo
      .createQueryBuilder('set')
      .innerJoin('set.email', 'email')
      .select('email.user_id', 'userId')
      .addSelect('COUNT(set.set_id)', 'count')
      .where('set.deleted_at IS NULL')
      .groupBy('email.user_id')
      .getRawMany<{ userId: number; count: string }>();

    const setCountByUser = new Map<number, number>(
      setCountRows.map((r) => [Number(r.userId), Number(r.count)]),
    );

    return users.map((u) => ({
      userId: u.userId,
      name: [u.firstName, u.lastName].filter(Boolean).join(' ') || '—',
      email: u.email,
      authType: u.authType,
      createdAt: u.createdAt,
      active: u.active,
      setCount: setCountByUser.get(u.userId) ?? 0,
      emails: u.emails.map((e) => e.email),
      phones: u.phones.map((p) => p.phone),
    }));
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

    const { transactions, transactionsError } =
      await this.loadTransactions(userId);

    const mappedSets = sets.map((s) => ({
      setId: s.setId,
      createdAt: s.createdAt,
      deletedAt: s.deletedAt,
      stripeSubscriptionId: s.stripeSubscriptionId,
      pendingCancelAt: s.pendingCancelAt,
      email: s.email?.email ?? null,
      phone: s.phone?.phone ?? null,
      promo: s.stripeSubscriptionId === 'PROMO',
      status: s.deletedAt
        ? 'cancelled'
        : s.pendingCancelAt
          ? 'pending_cancel'
          : 'active',
    }));

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
      transactions,
      transactionsError,
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
