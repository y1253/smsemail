import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Phone } from './phone.entity';
import { DeletedPhone } from './deleted-phone.entity';
import { PhoneVerification } from './phone-verification.entity';
import { PhonesService } from './phones.service';
import { PhonesController } from './phones.controller';
import { AuthModule } from '../auth/auth.module';
import { SignalwireModule } from '../signalwire/signalwire.module';
import { SetsModule } from '../sets/sets.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Phone, DeletedPhone, PhoneVerification]),
    AuthModule,
    SignalwireModule,
    SetsModule,
  ],
  controllers: [PhonesController],
  providers: [PhonesService],
})
export class PhonesModule {}
