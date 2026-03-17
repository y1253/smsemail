import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbConfigModule } from './db-config/db-config.module';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { CcModule } from './cc/cc.module';
import { EmailsModule } from './emails/emails.module';
import { SignalwireModule } from './signalwire/signalwire.module';
import { PhonesModule } from './phones/phones.module';

@Module({
  imports: [
    DbConfigModule,
    ConfigModule.forRoot({ isGlobal: true }),
    SignalwireModule,
    UsersModule,
    CcModule,
    EmailsModule,
    PhonesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

