import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { IncomeMessage } from '../messages/income-message.entity';
import { OutMessage } from '../messages/out-message.entity';

@Entity('email')
export class Email {
  @PrimaryGeneratedColumn({ name: 'email_id' })
  emailId!: number;

  @ManyToOne(() => User, (user) => user.emails)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'email', length: 145 })
  email!: string;

  @Column({ name: 'refresh_token', length: 245 })
  refreshToken!: string;

  @Column({ name: 'added_at', type: 'datetime' })
  addedAt!: Date;

  @Column({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt!: Date | null;

  @Column({ name: 'last_history_id', type: 'varchar', length: 30, nullable: true })
  lastHistoryId!: string | null;

  @Column({ name: 'watch_expiry', type: 'datetime', nullable: true })
  watchExpiry!: Date | null;

  @OneToMany(() => IncomeMessage, (message) => message.email)
  incomeMessages!: IncomeMessage[];

  @OneToMany(() => OutMessage, (message) => message.email)
  outMessages!: OutMessage[];
}

