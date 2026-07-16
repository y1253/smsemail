import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Public endpoint exposing the displayed subscription price so the client has a
// single source of truth. Display-only — the real Stripe charge is driven by
// STRIPE_PRICE_ID in sets.service.ts, independently of PRICE.
@Controller('pricing')
export class PricingController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  getPricing() {
    return {
      price: Number(this.config.get<string>('PRICE') ?? 10),
      currency: 'usd',
      interval: 'month',
    };
  }
}
