import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';

// All admin routes require a valid JWT (AuthGuard) whose email is in the
// ADMIN_EMAILS allowlist (AdminGuard). Replaces the old static x-admin-password
// header, which had no rate limiting and a shared secret.
@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('accounts')
  async getAccounts() {
    return this.adminService.getAllAccounts();
  }

  @Get('deleted')
  async getDeleted() {
    return this.adminService.getDeletedContacts();
  }

  @Get('accounts/:userId')
  async getAccount(@Param('userId', ParseIntPipe) userId: number) {
    return this.adminService.getAccountDetail(userId);
  }
}
