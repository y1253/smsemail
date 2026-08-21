import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export interface RateLimitOptions {
  /** Max requests allowed per window, per client IP + route. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export const RATE_LIMIT_KEY = 'rate_limit_options';

/**
 * Anti-automation for sensitive endpoints (login, register, phone verify, SMS
 * send). ASVS 2.2.1 / 11.1.4. In-memory fixed window — adequate because the app
 * runs as a single PM2 process; move to a shared store if it is ever scaled out.
 */
export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);

interface Counter {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, Counter>();
  private lastSweep = 0;

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!options) return true;

    const req = context.switchToHttp().getRequest();
    const now = performance.now();
    this.sweep(now);

    // Deliberately NOT X-Forwarded-For. nginx builds that header with
    // $proxy_add_x_forwarded_for, which appends the real peer to whatever the
    // client sent, so its first entry is attacker-controlled — keying on it
    // lets anyone reset their own limit by rotating a spoofed value.
    // X-Real-IP is set with proxy_set_header, which replaces any client copy,
    // and the app listens on loopback so only nginx can reach it.
    const ip =
      ((req.headers?.['x-real-ip'] as string | undefined)?.trim()) ||
      req.socket?.remoteAddress ||
      req.ip ||
      'unknown';
    const key = `${ip}:${req.method}:${req.route?.path ?? req.url}`;

    const existing = this.hits.get(key);
    if (!existing || existing.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + options.windowMs });
      return true;
    }

    if (existing.count >= options.limit) {
      throw new HttpException(
        'Too many requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    existing.count += 1;
    return true;
  }

  // Drop expired counters occasionally so the map can't grow without bound.
  private sweep(now: number): void {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [key, counter] of this.hits) {
      if (counter.resetAt <= now) this.hits.delete(key);
    }
  }
}
