import {
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly config: ConfigService,
  ) {}

  private assertAdmin(password: string) {
    const adminPassword = this.config.get<string>('ADMIN_PASSWORD');
    if (!adminPassword || password !== adminPassword) {
      throw new UnauthorizedException('Invalid admin password');
    }
  }

  @Get('accounts')
  async getAccounts(@Headers('x-admin-password') password: string) {
    this.assertAdmin(password);
    return this.adminService.getAllAccounts();
  }

  @Get('deleted')
  async getDeleted(@Headers('x-admin-password') password: string) {
    this.assertAdmin(password);
    return this.adminService.getDeletedContacts();
  }

  @Get('accounts/:userId')
  async getAccount(
    @Headers('x-admin-password') password: string,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    this.assertAdmin(password);
    return this.adminService.getAccountDetail(userId);
  }
}
