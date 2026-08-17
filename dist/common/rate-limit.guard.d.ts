import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
export interface RateLimitOptions {
    limit: number;
    windowMs: number;
}
export declare const RATE_LIMIT_KEY = "rate_limit_options";
export declare const RateLimit: (options: RateLimitOptions) => import("@nestjs/common").CustomDecorator<string>;
export declare class RateLimitGuard implements CanActivate {
    private readonly reflector;
    private readonly hits;
    private lastSweep;
    constructor(reflector: Reflector);
    canActivate(context: ExecutionContext): boolean;
    private sweep;
}
