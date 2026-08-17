"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const all_exceptions_filter_1 = require("./common/all-exceptions.filter");
function corsOrigins() {
    return (process.env.CORS_ORIGINS ?? 'https://emailontext.com')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);
}
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { rawBody: true });
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.disable('x-powered-by');
    app.use((_req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
        next();
    });
    app.enableCors({
        origin: corsOrigins(),
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'x-token'],
        credentials: false,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    app.useGlobalFilters(new all_exceptions_filter_1.AllExceptionsFilter());
    const host = process.env.HOST ?? '127.0.0.1';
    await app.listen(process.env.PORT ?? 3000, host);
}
bootstrap();
//# sourceMappingURL=main.js.map