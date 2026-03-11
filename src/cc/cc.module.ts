import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cc } from './cc.entity';
import { User } from '../users/user.entity';
import { CcService } from './cc.service';
import { CcController } from './cc.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Cc, User]), AuthModule],
  controllers: [CcController],
  providers: [CcService],
})
export class CcModule {}

