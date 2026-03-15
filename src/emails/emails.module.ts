import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Email } from './email.entity';
import { EmailsService } from './emails.service';
import { EmailsController } from './emails.controller';
import { AuthModule } from '../auth/auth.module';
import { User } from '../users/user.entity';
import { GoogleAuthProvider } from '../googleAuth/googleAuth.provider';

@Module({
  imports: [TypeOrmModule.forFeature([Email, User]), AuthModule],
  controllers: [EmailsController],
  providers: [EmailsService,GoogleAuthProvider],
})
export class EmailsModule { }

