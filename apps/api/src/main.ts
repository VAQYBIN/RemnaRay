import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { trustedProxies } from './common/trusted-proxies';
import { ZodValidationPipe } from './common/zod-validation.pipe';

const port = Number(process.env.PORT ?? 3000);

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    // Section 21.7: `X-Forwarded-*` counts only from `RR_TRUSTED_PROXIES`.
    new FastifyAdapter({ trustProxy: trustedProxies() }),
    {
      bufferLogs: true,
      rawBody: true,
    },
  );

  app.useLogger(app.get(Logger));
  app.useGlobalPipes(new ZodValidationPipe());
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
