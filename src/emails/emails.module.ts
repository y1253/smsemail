import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Email } from './email.entity';
import { DeletedEmail } from './deleted-email.entity';
import { EmailsService } from './emails.service';
import { EmailsController } from './emails.controller';
import { AuthModule } from '../auth/auth.module';
import { User } from '../users/user.entity';
import { GoogleAuthProvider } from '../googleAuth/googleAuth.provider';
import { GmailModule } from '../gmail/gmail.module';
import { SetsModule } from '../sets/sets.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Email, DeletedEmail, User]),
    AuthModule,
    GmailModule,
    forwardRef(() => SetsModule),
  ],
  controllers: [EmailsController],
  providers: [EmailsService, GoogleAuthProvider],
  exports: [EmailsService],
})
export class EmailsModule {}
