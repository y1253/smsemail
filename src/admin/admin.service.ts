import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { EmailPhoneSet } from '../sets/email-phone-set.entity';
import { Transaction } from '../transactions/transaction.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(EmailPhoneSet)
    private readonly setRepo: Repository<EmailPhoneSet>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
  ) {}

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

    const transactions = await this.transactionRepo
      .createQueryBuilder('transaction')
      .where('transaction.user_id = :userId', { userId })
      .orderBy('transaction.created_at', 'DESC')
      .getMany();

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
      transactions: transactions.map((t) => ({
        amount: t.amount,
        createdAt: t.createdAt,
      })),
    };
  }
}
