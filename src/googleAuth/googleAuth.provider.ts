import { OAuth2Client } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';

export const GoogleAuthProvider = {
  provide: 'GOOGLE_CLIENT',
  useFactory: (config: ConfigService) => {
    const clientId = config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = config.get<string>('GOOGLE_REDIRECT_URI');

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Google OAuth env vars are missing');
    }

    return new OAuth2Client(clientId, clientSecret, redirectUri);
  },
  inject: [ConfigService],
};
