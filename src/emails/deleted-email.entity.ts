import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('deleted_email')
export class DeletedEmail {
  @PrimaryGeneratedColumn({ name: 'deleted_email_id' })
  id!: number;

  @Column({ name: 'user_id' })
  userId!: number;

  @Column({ name: 'email_id' })
  originalEmailId!: number;

  @Column({ name: 'email', length: 145 })
  email!: string;

  @Column({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @Column({ name: 'deleted_at', type: 'datetime' })
  deletedAt!: Date;
}
