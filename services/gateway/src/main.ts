import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // `rawBody` keeps the unparsed bytes on `req.rawBody` next to the parsed
  // `req.body`, so the proxy can forward a request body the JSON parser already
  // consumed, byte for byte.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  await app.listen(Number(process.env.PORT ?? 3000));
}
bootstrap();
