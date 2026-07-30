import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { EmailPhoneSet } from '../sets/email-phone-set.entity';
import { DeletedEmail } from '../emails/deleted-email.entity';
import { DeletedPhone } from '../phones/deleted-phone.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, EmailPhoneSet, DeletedEmail, DeletedPhone]),
    BillingModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
