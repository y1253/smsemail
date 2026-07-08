import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('deleted_phone')
export class DeletedPhone {
  @PrimaryGeneratedColumn({ name: 'deleted_phone_id' })
  id!: number;

  @Column({ name: 'user_id' })
  userId!: number;

  @Column({ name: 'phone_id' })
  originalPhoneId!: number;

  @Column({ name: 'phone', length: 45 })
  phone!: string;

  @Column({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @Column({ name: 'deleted_at', type: 'datetime' })
  deletedAt!: Date;
}
