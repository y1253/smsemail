import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { EmailPhoneSet } from './email-phone-set.entity';

@Entity('set_allowed_sender')
export class SetAllowedSender {
  @PrimaryGeneratedColumn({ name: 'id' })
  id!: number;

  @ManyToOne(() => EmailPhoneSet, (set) => set.allowedSenders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'set_id' })
  set!: EmailPhoneSet;

  @Column({ name: 'email', type: 'varchar', length: 255 })
  email!: string;
}
