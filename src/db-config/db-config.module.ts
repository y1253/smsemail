import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';


import { Email } from '../emails/email.entity';
import { Phone } from '../phones/phone.entity';
import { Transaction } from '../transactions/transaction.entity';
import { User } from '../users/user.entity';
import { OutMessage } from '../messages/out-message.entity';
import { IncomeMessage } from '../messages/income-message.entity';
import { Subscription } from '../subscriptions/subscription.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      driver: require('mysql2'),
      host: 'localhost',
      port: 3306,
      username: 'yg',
      password: '12345',
      database: 'smsemail',
      synchronize: true,
      entities: [User, Email, Phone, Transaction, Subscription, IncomeMessage, OutMessage],

    }),
  ],
  exports: [TypeOrmModule],
})
export class DbConfigModule { }

