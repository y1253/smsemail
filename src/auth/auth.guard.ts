
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(private readonly authService:AuthService){}
  async canActivate(
    context: ExecutionContext,
  ){
    const request = context.switchToHttp().getRequest();
    return await this.authService.validCustomer(request)
  }
}
