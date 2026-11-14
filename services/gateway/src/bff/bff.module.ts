import { Module } from '@nestjs/common';
import { BffController } from './bff.controller';
import { BffService, FETCH_IMPL, UPSTREAMS } from './bff.service';
import { FetchLike, readUpstreamsFromEnv } from './upstream';

@Module({
  controllers: [BffController],
  providers: [
    BffService,
    { provide: UPSTREAMS, useFactory: () => readUpstreamsFromEnv() },
    {
      provide: FETCH_IMPL,
      useFactory: (): FetchLike => ((globalThis as { fetch: unknown }).fetch as FetchLike),
    },
  ],
})
export class BffModule {}
