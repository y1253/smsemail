import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('pending_sms_command')
export class PendingSmsCommand {
  @PrimaryGeneratedColumn({ name: 'id' })
  id!: number;

  @Column({ name: 'phone', length: 45 })
  phone!: string;

  @Column({ name: 'body', type: 'text' })
  body!: string;

  @Column({ name: 'email_ids', length: 255 })
  emailIds!: string;

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
