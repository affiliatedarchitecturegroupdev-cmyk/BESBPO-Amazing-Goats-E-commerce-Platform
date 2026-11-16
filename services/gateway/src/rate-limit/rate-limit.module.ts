import { Module } from '@nestjs/common';
import { RateLimitController } from './rate-limit.controller';
import { RateLimitService, RATE_LIMIT_RULES } from './rate-limit.service';
import { RATE_LIMIT_STORE, InMemoryRateLimitStore } from './rate-limit.store';
import { ROUTE_RULES } from './rate-limit.rules';

@Module({
  controllers: [RateLimitController],
  providers: [
    RateLimitService,
    { provide: RATE_LIMIT_STORE, useFactory: () => new InMemoryRateLimitStore() },
    { provide: RATE_LIMIT_RULES, useValue: ROUTE_RULES },
  ],
  exports: [RateLimitService],
})
export class RateLimitModule {}
