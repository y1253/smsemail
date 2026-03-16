import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('transaction')
export class Transaction {
  @PrimaryGeneratedColumn({ name: 'transaction_id' })
  transactionId!: number;

  @ManyToOne(() => User, (user) => user.transactions)
  @JoinColumn({ name: 'user_id' })
  user!: User;



  @Column({
    name: 'amont',
    type: 'decimal',
    precision: 9,
    scale: 2,
  })
  amount!: string;

  @Column({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}

