import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Email } from '../emails/email.entity';
import { Phone } from '../phones/phone.entity';
import { EmailPhoneSet } from './email-phone-set.entity';
import { SetAllowedSender } from './set-allowed-sender.entity';
import { SetsService } from './sets.service';
import { SetsController } from './sets.controller';
import { AuthModule } from '../auth/auth.module';
import { EmailsModule } from '../emails/emails.module';
import { GmailModule } from '../gmail/gmail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Email, Phone, EmailPhoneSet, SetAllowedSender]),
    AuthModule,
    EmailsModule,
    GmailModule,
  ],
  controllers: [SetsController],
  providers: [SetsService],
})
export class SetsModule {}

