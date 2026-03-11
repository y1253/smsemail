import { Module } from '@nestjs/common';
import { GoogleAuthProvider } from '../googleAuth/googleAuth.provider';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    JwtModule.register({
      global: true,
      secret: 'example',
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService, GoogleAuthProvider],
})
export class UsersModule {}

