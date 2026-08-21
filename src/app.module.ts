import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RateLimitGuard } from './common/rate-limit.guard';
import { DbConfigModule } from './db-config/db-config.module';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { CcModule } from './cc/cc.module';
import { BillingModule } from './billing/billing.module';
import { EmailsModule } from './emails/emails.module';
import { SignalwireModule } from './signalwire/signalwire.module';
import { MailerModule } from './mailer/mailer.module';
import { PhonesModule } from './phones/phones.module';
import { SetsModule } from './sets/sets.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { OpenAiModule } from './openai/openai.module';
import { AdminModule } from './admin/admin.module';
import { PricingModule } from './pricing/pricing.module';
import { validateEnv } from './common/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    DbConfigModule,
    ScheduleModule.forRoot(),
    SignalwireModule,
    MailerModule,
    UsersModule,
    CcModule,
    BillingModule,
    EmailsModule,
    PhonesModule,
    SetsModule,
    WebhooksModule,
    OpenAiModule,
    AdminModule,
    PricingModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global guard: enforces @RateLimit() where present, no-op elsewhere.
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
})
export class AppModule {}

