import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { allowedOrigins, Env, loadEnv } from './config/env';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function configureApp(app: INestApplication, env: Env): void {
  const origins = allowedOrigins(env);
  app.setGlobalPrefix('api');
  // Explicit allowlist with credentials (legacy defect: origin: true).
  app.enableCors({ origin: origins, credentials: true });
  app.use(cookieParser());
  // Second line of CSRF defence after SameSite=Lax: a browser request that
  // changes data must come from one of our own origins.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (!SAFE_METHODS.has(req.method) && origin && !origins.includes(origin)) {
      res.status(403).json({ statusCode: 403, message: 'Origin not allowed' });
      return;
    }
    next();
  });
  app.enableShutdownHooks();
}

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  configureApp(app, env);
  await app.listen(env.PORT, '0.0.0.0');
}

if (require.main === module) {
  void bootstrap();
}
