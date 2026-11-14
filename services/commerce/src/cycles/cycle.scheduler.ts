import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CyclesService } from './cycles.service';

/**
 * Periodic cycle scheduler. Runs one tick at start-up and then every
 * `CYCLE_TICK_MS` (default 15 minutes), which is enough to open a cycle and to
 * close it within minutes of its cut-off. A single in-process interval is
 * acceptable while commerce runs as one deployable; a shared lock is needed
 * once more than one instance runs (tracked with the launch hardening).
 */
@Injectable()
export class CycleScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CycleScheduler.name);
  private readonly intervalMs = Number(process.env.CYCLE_TICK_MS ?? 900_000);
  private timer?: NodeJS.Timeout;

  constructor(private readonly cycles: CyclesService) {}

  onModuleInit(): void {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(now: Date = new Date()): Promise<void> {
    try {
      const report = await this.cycles.tick(now);
      if (report.generated.length || report.closed.length) this.logger.log(JSON.stringify(report));
    } catch (error) {
      this.logger.error(`cycle tick failed: ${(error as Error).message}`);
    }
  }
}
