import { Module } from '@nestjs/common';
import { GoogleAuthProvider } from '../googleAuth/googleAuth.provider';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    AuthModule,
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) {
          // Defence in depth: validateEnv already blocks boot without this,
          // but never fall back to a hardcoded secret.
          throw new Error('JWT_SECRET is not set');
        }
        return {
          secret,
          signOptions: {
            expiresIn: '24h',
            issuer: 'emailontext',
            audience: 'emailontext-app',
          },
          verifyOptions: {
            algorithms: ['HS256'],
            issuer: 'emailontext',
            audience: 'emailontext-app',
          },
        };
      },
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService, GoogleAuthProvider],
})
export class UsersModule {}

