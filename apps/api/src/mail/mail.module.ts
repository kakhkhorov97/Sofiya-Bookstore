import { Global, Module } from '@nestjs/common';
import { loadEnv } from '../config/env';
import { createMailer, MAILER } from './mailer';

@Global()
@Module({
  providers: [{ provide: MAILER, useFactory: () => createMailer(loadEnv()) }],
  exports: [MAILER],
})
export class MailModule {}
