import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('phone')
export class Phone {
  @PrimaryGeneratedColumn({ name: 'phone_id' })
  phoneId!: number;

  @ManyToOne(() => User, (user) => user.phones)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'phone', length: 45 })
  phone!: string;

  @Column({ name: 'added_at', type: 'datetime' })
  addedAt!: Date;

  @Column({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt!: Date | null;
}

