import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbConfigModule } from './db-config/db-config.module';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { CcModule } from './cc/cc.module';
import { EmailsModule } from './emails/emails.module';
import { SignalwireModule } from './signalwire/signalwire.module';
import { PhonesModule } from './phones/phones.module';
import { SetsModule } from './sets/sets.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { OpenAiModule } from './openai/openai.module';

@Module({
  imports: [
    DbConfigModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    SignalwireModule,
    UsersModule,
    CcModule,
    EmailsModule,
    PhonesModule,
    SetsModule,
    WebhooksModule,
    OpenAiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

