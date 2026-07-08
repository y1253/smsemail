import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';


import { Email } from '../emails/email.entity';
import { Phone } from '../phones/phone.entity';
import { PhoneVerification } from '../phones/phone-verification.entity';
import { Transaction } from '../transactions/transaction.entity';
import { User } from '../users/user.entity';
import { OutMessage } from '../messages/out-message.entity';
import { IncomeMessage } from '../messages/income-message.entity';
import { Subscription } from '../subscriptions/subscription.entity';
import { EmailPhoneSet } from '../sets/email-phone-set.entity';
import { SetAllowedSender } from '../sets/set-allowed-sender.entity';
import { PendingSmsCommand } from '../webhooks/pending-sms-command.entity';
import { DeletedEmail } from '../emails/deleted-email.entity';
import { DeletedPhone } from '../phones/deleted-phone.entity';

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
      entities: [User, Email, Phone, PhoneVerification, Transaction, Subscription, IncomeMessage, OutMessage, EmailPhoneSet, SetAllowedSender, PendingSmsCommand, DeletedEmail, DeletedPhone],

    }),
  ],
  exports: [TypeOrmModule],
})
export class DbConfigModule { }

