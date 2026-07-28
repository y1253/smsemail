import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Email } from '../emails/email.entity';

@Entity('income_message')
export class IncomeMessage {
  @PrimaryGeneratedColumn({ name: 'message_id' })
  messageId!: number;

  @ManyToOne(() => Email, (email) => email.incomeMessages)
  @JoinColumn({ name: 'email_id' })
  email!: Email;

  // Indexed: message ids are random, so this is both the "latest message"
  // sort key and the cutoff the daily prune scans on.
  @Index()
  @Column({ name: 'create_at', type: 'datetime' })
  createdAt!: Date;

  @Column({ name: 'gmail_message_id', length: 145 })
  gmailMessageId!: string;

  @Column({ name: 'gmail_thread_id', length: 145 })
  gmailThreadId!: string;

  @Column({ name: 'sender', length: 145 })
  sender!: string;

  @Column({ name: 'subject', length: 255 })
  subject!: string;
}

