import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Email } from '../emails/email.entity';

// The same Gmail message reaches us many times over: Pub/Sub push is
// at-least-once, and Gmail emits several notifications per change. This index
// is what makes processing idempotent — the insert IS the dedup, so a replay
// can never turn into a second SMS.
@Index('uq_income_message_gmail', ['email', 'gmailMessageId'], { unique: true })
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

  // RFC-5322 Message-ID header of the original mail (<...@mail.gmail.com>) —
  // NOT gmailMessageId, which is Gmail's internal api id. Replies need this in
  // In-Reply-To/References or the recipient's client shows a new conversation.
  // Nullable: rows written before this column existed have to fall back to
  // re-fetching the header from Gmail.
  // type is explicit: the `string | null` union reflects as Object, which
  // TypeORM cannot map to a MySQL type on its own.
  @Column({
    name: 'rfc_message_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  rfcMessageId!: string | null;

  @Column({ name: 'references_header', type: 'text', nullable: true })
  referencesHeader!: string | null;

  // Sets that still owe a text for this mail, comma-separated ("12,17"), or
  // null when nothing is outstanding. The row is inserted before the SMS goes
  // out (it is the dedup claim), so without this a send failure would be
  // indistinguishable from a delivered message and the mail would be lost.
  // Same explicit `type:` as rfcMessageId above, for the same reason.
  @Column({
    name: 'pending_set_ids',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  pendingSetIds!: string | null;

  // Bounds the retry sweeper: incremented on every attempt, including ones that
  // fail before the send (e.g. Gmail refetch), so a permanently broken message
  // stops being retried instead of being re-summarized forever.
  @Column({ name: 'send_attempts', type: 'int', default: 0 })
  sendAttempts!: number;

  @Column({ name: 'last_attempt_at', type: 'datetime', nullable: true })
  lastAttemptAt!: Date | null;
}
