import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { EmailPhoneSet } from '../sets/email-phone-set.entity';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, EmailPhoneSet]), AuthModule],
  controllers: [BillingController],
  providers: [BillingService],
  // AdminModule reads a user's transaction history through this service so the
  // admin view and the customer's own Billing page share one Stripe mapping.
  exports: [BillingService],
})
export class BillingModule {}
