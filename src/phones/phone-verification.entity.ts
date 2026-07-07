import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('phone_verification')
export class PhoneVerification {
  @PrimaryGeneratedColumn({ name: 'id' })
  id!: number;

  @Column({ name: 'user_id', type: 'int' })
  userId!: number;

  @Column({ name: 'phone', length: 45 })
  phone!: string;

  @Column({ name: 'code', length: 10 })
  code!: string;

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt!: Date;

  @Column({ name: 'consent_at', type: 'datetime', nullable: true })
  consentAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
