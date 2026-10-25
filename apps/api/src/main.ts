import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { allowedOrigins, Env, loadEnv } from './config/env';

export function configureApp(app: INestApplication, env: Env): void {
  app.setGlobalPrefix('api');
  // Explicit allowlist with credentials (legacy defect: origin: true).
  app.enableCors({ origin: allowedOrigins(env), credentials: true });
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
