import { Module } from '@nestjs/common';
import { GoogleAuthProvider } from '../googleAuth/googleAuth.provider';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'changeme',
      }),
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService, GoogleAuthProvider],
})
export class UsersModule {}

