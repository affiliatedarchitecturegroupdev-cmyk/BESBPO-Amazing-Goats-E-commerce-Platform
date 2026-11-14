import { Module } from '@nestjs/common';
import { InMemoryAlertSink, WebhookAlertSink } from '@ag/observability';
import type { AlertSink } from '@ag/observability';
import { TemperatureController } from './temperature.controller';
import {
  TemperatureService,
  TEMPERATURE_STORE,
  SUBJECT_CLASS_SOURCE,
  ALERT_SINK,
} from './temperature.service';
import { TemperatureScheduler } from './temperature.scheduler';
import { InMemoryTemperatureStore } from './temperature.types';
import { InMemorySubjectClassSource } from './temperature.store';

// When ALERT_WEBHOOK_URL is set (Northflank injects it from the secret group),
// alerts go to the notification webhook; otherwise they stay in memory so a
// local run does not try to reach the network.
const alertSinkFactory = (): AlertSink => {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (url) return new WebhookAlertSink({ url, secret: process.env.ALERT_WEBHOOK_SECRET });
  return new InMemoryAlertSink();
};

@Module({
  controllers: [TemperatureController],
  providers: [
    TemperatureService,
    TemperatureScheduler,
    { provide: TEMPERATURE_STORE, useFactory: () => new InMemoryTemperatureStore() },
    { provide: SUBJECT_CLASS_SOURCE, useFactory: () => new InMemorySubjectClassSource() },
    { provide: ALERT_SINK, useFactory: alertSinkFactory },
  ],
})
export class TemperatureModule {}
