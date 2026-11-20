import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { missingRequiredUpstreams, readUpstreamsFromEnv } from './bff/upstream';

async function bootstrap() {
  // Refuse to start a deployment that cannot reach the services the front ends
  // call. Failing here names the missing variable in the boot log; the
  // alternative is a gateway that passes its health check and then answers 500
  // for every catalogue read, which reads as a code bug rather than a missing
  // environment variable.
  const missing = missingRequiredUpstreams(readUpstreamsFromEnv());
  if (missing.length > 0) {
    Logger.error(
      `gateway cannot start: no address for ${missing.join(', ')}. ` +
        `Set ${missing.map((n) => `${n.toUpperCase()}_URL`).join(', ')} to the service address.`,
      'Bootstrap',
    );
    process.exit(1);
  }

  // `rawBody` keeps the unparsed bytes on `req.rawBody` next to the parsed
  // `req.body`, so the proxy can forward a request body the JSON parser already
  // consumed, byte for byte.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  await app.listen(Number(process.env.PORT ?? 3000));
}
bootstrap();
