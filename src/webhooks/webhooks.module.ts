import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Email } from '../emails/email.entity';
import { Phone } from '../phones/phone.entity';
import { EmailPhoneSet } from '../sets/email-phone-set.entity';
import { IncomeMessage } from '../messages/income-message.entity';
import { EmailsModule } from '../emails/emails.module';
import { GmailModule } from '../gmail/gmail.module';
import { OpenAiModule } from '../openai/openai.module';
import { WebhooksService } from './webhooks.service';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Email, Phone, EmailPhoneSet, IncomeMessage]),
    EmailsModule,
    GmailModule,
    OpenAiModule,
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
