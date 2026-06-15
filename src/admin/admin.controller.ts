import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly config: ConfigService,
  ) {}

  @Get('accounts')
  async getAccounts(@Headers('x-admin-password') password: string) {
    const adminPassword = this.config.get<string>('ADMIN_PASSWORD');
    if (!adminPassword || password !== adminPassword) {
      throw new UnauthorizedException('Invalid admin password');
    }
    return this.adminService.getAllAccounts();
  }
}
