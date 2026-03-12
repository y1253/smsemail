import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Transaction } from '../transactions/transaction.entity';
import { Subscription } from '../subscriptions/subscription.entity';

@Entity('cc')
export class Cc {
  @PrimaryGeneratedColumn({ name: 'cc_id' })
  ccId!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'cc', length: 45 })
  cc!: string;

  @Column({ name: 'added_at', type: 'datetime' })
  addedAt!: Date;

  @Column({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt!: Date | null;

  @OneToMany(() => Transaction, (transaction) => transaction.cc)
  transactions!: Transaction[];

  @OneToMany(() => Subscription, (subscription) => subscription.cc)
  subscriptions!: Subscription[];
}

