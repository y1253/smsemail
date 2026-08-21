import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { AdminGuard } from './admin.guard';
import { User } from '../users/user.entity';

@Module({
  // User is registered directly rather than by importing UsersModule, which
  // imports this module — pulling it in here would create a cycle.
  imports: [TypeOrmModule.forFeature([User])],
  providers: [AuthService, AuthGuard, AdminGuard],
  exports: [AuthService, AuthGuard, AdminGuard],
})
export class AuthModule {}
