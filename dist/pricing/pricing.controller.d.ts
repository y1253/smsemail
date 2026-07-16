import { ConfigService } from '@nestjs/config';
export declare class PricingController {
    private readonly config;
    constructor(config: ConfigService);
    getPricing(): {
        price: number;
        currency: string;
        interval: string;
    };
}
