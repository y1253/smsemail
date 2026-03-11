import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Email } from '../emails/email.entity';
import { Phone } from '../phones/phone.entity';
import { Cc } from '../cc/cc.entity';
import { Transaction } from '../transactions/transaction.entity';
import { Subscription } from '../subscriptions/subscription.entity';

@Entity('user')
export class User {
  @PrimaryGeneratedColumn({ name: 'user_id' })
  userId!: number;

  @Column({ name: 'first_name', length: 145, nullable: true })
  firstName!: string | null;

  @Column({ name: 'last_name', length: 145, nullable: true })
  lastName!: string | null;

  @Column({ name: 'email', length: 145, nullable: true })
  email!: string | null;

  @Column({ name: 'password', length: 45 })
  password!: string;

  @Column({ name: 'auth_type', length: 45, nullable: true })
  authType!: string | null;

  @CreateDateColumn({ name: 'create_at', type: 'datetime' })
  createdAt!: Date;

  @Column({ name: 'active', type: 'tinyint', nullable: true })
  active!: number | null;

  @OneToMany(() => Email, (email) => email.user)
  emails!: Email[];

  @OneToMany(() => Phone, (phone) => phone.user)
  phones!: Phone[];

  @OneToMany(() => Cc, (cc) => cc.user)
  ccs!: Cc[];

  @OneToMany(() => Transaction, (transaction) => transaction.user)
  transactions!: Transaction[];

  @OneToMany(() => Subscription, (subscription) => subscription.user)
  subscriptions!: Subscription[];
}

