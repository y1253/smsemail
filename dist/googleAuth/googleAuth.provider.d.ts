import { OAuth2Client } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';
export declare const GoogleAuthProvider: {
    provide: string;
    useFactory: (config: ConfigService) => OAuth2Client;
    inject: (typeof ConfigService)[];
};
