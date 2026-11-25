import { Module } from '@nestjs/common';
import { FetchLike, readUpstreamsFromEnv } from '../bff/upstream';
import { UPSTREAMS } from '../bff/bff.service';
import { ProxyController } from './proxy.controller';
import { PROXY_FETCH, ProxyService } from './proxy.service';

/**
 * The reverse proxy for the service prefixes. It reads the same upstream map
 * as the BFF (`<NAME>_URL`, else the local ports), so one environment variable
 * moves a service for both.
 */
@Module({
  controllers: [ProxyController],
  providers: [
    ProxyService,
    { provide: UPSTREAMS, useFactory: () => readUpstreamsFromEnv() },
    {
      provide: PROXY_FETCH,
      useFactory: (): FetchLike => ((globalThis as { fetch: unknown }).fetch as FetchLike),
    },
  ],
})
export class ProxyModule {}
