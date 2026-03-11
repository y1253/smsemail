import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('price')
export class Price {
  @PrimaryGeneratedColumn({ name: 'price_id' })
  priceId!: number;

  @Column({
    name: 'price',
    type: 'decimal',
    precision: 9,
    scale: 2,
  })
  price!: string;

  @Column({
    name: 'additional',
    type: 'decimal',
    precision: 9,
    scale: 2,
  })
  additional!: string;

  @Column({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @Column({ name: 'dleleted_at', type: 'datetime', nullable: true })
  deletedAt!: Date | null;
}

