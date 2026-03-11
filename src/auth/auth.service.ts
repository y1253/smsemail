import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
    constructor (
        private readonly jwtService:JwtService
    ){}

    async validCustomer(request:any):Promise<boolean>{
        const token = request.headers['x-token'];

    if (!token) {
      throw new UnauthorizedException('Missing token');
    }

    try {
      const decoded = await this.jwtService.verify(token);
      request.user = decoded;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    }
}
