"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleAuthProvider = void 0;
const google_auth_library_1 = require("google-auth-library");
const config_1 = require("@nestjs/config");
exports.GoogleAuthProvider = {
    provide: 'GOOGLE_CLIENT',
    useFactory: (config) => {
        const clientId = config.get('GOOGLE_CLIENT_ID');
        const clientSecret = config.get('GOOGLE_CLIENT_SECRET');
        const redirectUri = config.get('GOOGLE_REDIRECT_URI');
        if (!clientId || !clientSecret || !redirectUri) {
            throw new Error('Google OAuth env vars are missing');
        }
        return new google_auth_library_1.OAuth2Client(clientId, clientSecret, redirectUri);
    },
    inject: [config_1.ConfigService],
};
//# sourceMappingURL=googleAuth.provider.js.map