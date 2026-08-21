import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async validCustomer(request: any): Promise<boolean> {
    // Header only — never a query parameter, so a token cannot leak through a
    // URL, referrer or access log (ASVS 3.1.1).
    const token = request.headers['x-token'];

    if (!token) {
      throw new UnauthorizedException('Missing token');
    }

    let decoded: { user_id: number; email: string; tv?: number };
    try {
      decoded = await this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    // Session-generation check (ASVS 3.3.3). A password change or reset bumps
    // user.token_version, which strands every token minted before it — that is
    // what terminates sessions on other devices despite the JWT being
    // stateless. Tokens issued before this column existed carry no tv and are
    // treated as generation 0, matching the column default, so deploying this
    // does not sign anyone out on its own.
    const current = await this.userRepo.findOne({
      where: { userId: decoded.user_id },
      select: ['userId', 'tokenVersion'],
    });

    if (!current) {
      throw new UnauthorizedException('Invalid token');
    }

    if ((decoded.tv ?? 0) !== (current.tokenVersion ?? 0)) {
      throw new UnauthorizedException(
        'Session ended because the account password was changed. Please sign in again.',
      );
    }

    request.user = decoded;
    return true;
  }
}
