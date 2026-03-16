import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';


@Entity('subscription')
export class Subscription {
  @PrimaryGeneratedColumn({ name: 'subscription_id' })
  subscriptionId!: number;

  @ManyToOne(() => User, (user) => user.subscriptions)
  @JoinColumn({ name: 'user_id' })
  user!: User;



  @Column({ name: 'activate_at', type: 'datetime' })
  activateAt!: Date;

  @Column({ name: 'deactivate_at', type: 'datetime', nullable: true })
  deactivateAt!: Date | null;
}

