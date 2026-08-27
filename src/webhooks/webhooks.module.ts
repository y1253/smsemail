import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Email } from '../emails/email.entity';
import { Phone } from '../phones/phone.entity';
import { EmailPhoneSet } from '../sets/email-phone-set.entity';
import { SetAllowedSender } from '../sets/set-allowed-sender.entity';
import { IncomeMessage } from '../messages/income-message.entity';
import { PendingSmsCommand } from './pending-sms-command.entity';
import { EmailsModule } from '../emails/emails.module';
import { GmailModule } from '../gmail/gmail.module';
import { OpenAiModule } from '../openai/openai.module';
import { BillingModule } from '../billing/billing.module';
import { WebhooksService } from './webhooks.service';
import { WebhookSecurityService } from './webhook-security.service';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Email, Phone, EmailPhoneSet, SetAllowedSender, IncomeMessage, PendingSmsCommand]),
    EmailsModule,
    GmailModule,
    OpenAiModule,
    BillingModule,
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookSecurityService],
})
export class WebhooksModule {}
