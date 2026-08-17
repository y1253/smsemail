import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

// Comma-separated allowlist of browser origins permitted to call the API.
// Defaults to the production site; override with CORS_ORIGINS in .env.
function corsOrigins(): string[] {
  return (process.env.CORS_ORIGINS ?? 'https://emailontext.com')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Stop leaking the framework/version. (Also stripped at nginx.)
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.disable('x-powered-by');

  // Security headers, defense-in-depth behind nginx (nginx is the primary layer
  // the DAST scanner sees). Kept dependency-free on purpose.
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload',
    );
    next();
  });

  // Lock CORS to known origins (was a wildcard). JWT travels in the x-token
  // header, so it must be an allowed request header.
  app.enableCors({
    origin: corsOrigins(),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-token'],
    credentials: false,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  // Bind to loopback so the API is only reachable through nginx (TLS). Prevents
  // http://<host>:3000 from bypassing TLS + headers. Override with HOST=0.0.0.0.
  const host = process.env.HOST ?? '127.0.0.1';
  await app.listen(process.env.PORT ?? 3000, host);
}
bootstrap();
