import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { EmailPhoneSet } from '../sets/email-phone-set.entity';
import { Transaction } from '../transactions/transaction.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, EmailPhoneSet, Transaction])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
