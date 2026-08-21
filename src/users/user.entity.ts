import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Email } from '../emails/email.entity';
import { Phone } from '../phones/phone.entity';
import { Transaction } from '../transactions/transaction.entity';
import { Subscription } from '../subscriptions/subscription.entity';

@Entity('user')
export class User {
  @PrimaryGeneratedColumn({ name: 'user_id' })
  userId!: number;

  @Column({ name: 'first_name', type: 'varchar', length: 145, nullable: true })
  firstName!: string | null;

  @Column({ name: 'last_name', type: 'varchar', length: 145, nullable: true })
  lastName!: string | null;

  @Column({ name: 'email', type: 'varchar', length: 145, nullable: true })
  email!: string | null;

  @Column({ name: 'password', type: 'varchar', length: 245, nullable: true })
  password!: string | null;

  @Column({ name: 'auth_type', type: 'varchar', length: 45, nullable: true })
  authType!: string | null;

  /**
   * Set when `password` holds a temporary one emailed by the forgot-password
   * flow; login rejects it past this instant. NULL means a normal, permanent
   * password — changePassword clears it back to NULL.
   */
  @Column({
    name: 'temp_password_expires_at',
    type: 'datetime',
    nullable: true,
  })
  tempPasswordExpiresAt!: Date | null;

  @CreateDateColumn({ name: 'create_at', type: 'datetime' })
  createdAt!: Date;

  @Column({ name: 'stripe_customer_id', type: 'varchar', length: 245, nullable: true })
  stripeCustomerId!: string | null;

  @Column({ name: 'active', type: 'tinyint', nullable: true })
  active!: number | null;

  @OneToMany(() => Email, (email) => email.user)
  emails!: Email[];

  @OneToMany(() => Phone, (phone) => phone.user)
  phones!: Phone[];

  @OneToMany(() => Transaction, (transaction) => transaction.user)
  transactions!: Transaction[];

  @OneToMany(() => Subscription, (subscription) => subscription.user)
  subscriptions!: Subscription[];
}

