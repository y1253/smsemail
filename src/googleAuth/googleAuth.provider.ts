import { OAuth2Client } from 'google-auth-library';

export const GoogleAuthProvider = {
  provide: 'GOOGLE_CLIENT',
  useFactory: () => {
    return new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  },
};
