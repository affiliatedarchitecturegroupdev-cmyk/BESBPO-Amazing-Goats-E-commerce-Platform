import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody keeps the exact bytes of every request so the Resend webhook can be
  // verified against the signature it sent, before any JSON parsing.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  await app.listen(Number(process.env.PORT ?? 3006));
}
bootstrap();
