import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Email } from '../emails/email.entity';
import { Phone } from '../phones/phone.entity';
import { SetAllowedSender } from './set-allowed-sender.entity';

@Entity('email_phone_set')
export class EmailPhoneSet {
  @PrimaryGeneratedColumn({ name: 'set_id' })
  setId!: number;

  @ManyToOne(() => Email)
  @JoinColumn({ name: 'email_id' })
  email!: Email;

  @ManyToOne(() => Phone)
  @JoinColumn({ name: 'phone_id' })
  phone!: Phone;

  @Column({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @Column({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt!: Date | null;

  @Column({ name: 'stripe_subscription_id', type: 'varchar', length: 100, nullable: true })
  stripeSubscriptionId!: string | null;

  @OneToMany(() => SetAllowedSender, (s) => s.set, { eager: false })
  allowedSenders!: SetAllowedSender[];
}

