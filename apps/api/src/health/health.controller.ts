import { Controller, Get } from '@nestjs/common';
import { loadEnv } from '../config/env';

export interface HealthResponse {
  status: 'ok';
  service: 'api';
  version: string;
  uptimeSeconds: number;
}

@Controller('health')
export class HealthController {
  private readonly version = loadEnv().APP_VERSION;

  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      service: 'api',
      version: this.version,
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
