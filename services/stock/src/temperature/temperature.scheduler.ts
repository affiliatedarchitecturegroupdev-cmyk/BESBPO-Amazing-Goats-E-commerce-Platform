import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createLogger } from '@ag/observability';
import type { Logger } from '@ag/observability';
import { TemperatureService } from './temperature.service';

/**
 * Periodic cold-chain check. Re-evaluates stored readings every
 * `TEMPERATURE_TICK_MS` (default 15 minutes) so a breach that arrives without a
 * write (a probe that only syncs in batches) is still caught and alerted. One
 * in-process interval is acceptable while stock runs as a single deployable; a
 * shared lock is needed once more than one instance runs.
 */
@Injectable()
export class TemperatureScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger: Logger = createLogger({ service: 'stock' });
  private readonly intervalMs = Number(process.env.TEMPERATURE_TICK_MS ?? 900_000);
  private timer?: NodeJS.Timeout;

  constructor(private readonly temperature: TemperatureService) {}

  onModuleInit(): void {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    try {
      const report = await this.temperature.evaluateAll();
      if (report.incidents > 0) this.logger.warn('cold-chain check found breaches', report);
    } catch (error) {
      this.logger.error('cold-chain check failed', { error });
    }
  }
}
