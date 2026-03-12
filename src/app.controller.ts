import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { readFileSync } from 'fs';
import { join } from 'path';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('trypayment')
  getTestHtml(): string {
    const filePath = join(__dirname, '..', 'test-client.html');
    return readFileSync(filePath, 'utf8');
  }
}
