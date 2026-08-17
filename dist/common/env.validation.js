"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnv = validateEnv;
const REQUIRED = [
    'JWT_SECRET',
    'REFRESH_TOKEN_KEY',
    'DB_HOST',
    'DB_PORT',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
];
function validateEnv(config) {
    const errors = [];
    for (const key of REQUIRED) {
        const value = config[key];
        if (value === undefined || value === null || String(value).trim() === '') {
            errors.push(`${key} is required but not set`);
        }
    }
    const refreshKey = config['REFRESH_TOKEN_KEY'];
    if (typeof refreshKey === 'string' && refreshKey.length > 0 && refreshKey.length < 32) {
        errors.push('REFRESH_TOKEN_KEY must be at least 32 characters');
    }
    const jwtSecret = config['JWT_SECRET'];
    if (typeof jwtSecret === 'string' && (jwtSecret === 'changeme' || jwtSecret.length < 16)) {
        errors.push('JWT_SECRET is too weak (min 16 chars, and must not be the "changeme" placeholder)');
    }
    if (errors.length > 0) {
        throw new Error(`Invalid environment configuration:\n  - ${errors.join('\n  - ')}\n` +
            `See server/.env.example for the full list of required variables.`);
    }
    return config;
}
//# sourceMappingURL=env.validation.js.map