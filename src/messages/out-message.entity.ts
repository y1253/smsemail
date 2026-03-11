import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Email } from '../emails/email.entity';

@Entity('out_mesage')
export class OutMessage {
  @PrimaryGeneratedColumn({ name: 'out_mesage_id' })
  outMessageId!: number;

  @ManyToOne(() => Email, (email) => email.outMessages)
  @JoinColumn({ name: 'email_id' })
  email!: Email;

  @Column({ name: 'sent_to', length: 145 })
  sentTo!: string;

  @Column({ name: 'create_at', type: 'datetime' })
  createdAt!: Date;
}

