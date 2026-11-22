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
  // The assistant reads the same upstreams through the same fetch, so it
  // reuses these rather than holding a second configuration.
  exports: [UPSTREAMS, FETCH_IMPL],
})
export class BffModule {}
