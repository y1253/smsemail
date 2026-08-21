import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';

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

// Standalone DataSource used by the TypeORM CLI for migrations (the running app
// configures TypeORM via db-config.module.ts). Migrations replace synchronize:true
// so the app never mutates the live schema on boot.
dotenv.config();

export default new DataSource({
  type: 'mysql',
  // Same driver the running app uses (db-config.module.ts). Without this
  // TypeORM loads the legacy `mysql` package, which cannot speak
  // caching_sha2_password and fails the handshake with ER_NOT_SUPPORTED_AUTH_MODE.
  driver: require('mysql2'),
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  synchronize: false,
  entities: [
    User, Email, Phone, PhoneVerification, Transaction, Subscription,
    IncomeMessage, OutMessage, EmailPhoneSet, SetAllowedSender,
    PendingSmsCommand, DeletedEmail, DeletedPhone,
  ],
  migrations: ['src/db-config/migrations/*.ts'],
});
