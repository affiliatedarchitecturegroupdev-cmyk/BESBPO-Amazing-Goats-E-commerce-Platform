import { Module } from '@nestjs/common';
import { CAMPAIGNS_STORE } from './campaigns/campaigns.service';
import { CREATIVES_STORE } from './creatives/creatives.service';
import { InMemoryCampaignsStore } from './campaigns/campaigns.store';
import { InMemoryCreativesStore } from './creatives/creatives.store';

/**
 * The one place the ads stores are built, so campaigns, creatives and
 * decisioning share the same instances. The in-memory stores are the default;
 * the SQL adapters over the `ads` schema land with the store swap, the same way
 * the payments and accounts services did it.
 */
@Module({
  providers: [
    { provide: CAMPAIGNS_STORE, useFactory: () => new InMemoryCampaignsStore() },
    { provide: CREATIVES_STORE, useFactory: () => new InMemoryCreativesStore() },
  ],
  exports: [CAMPAIGNS_STORE, CREATIVES_STORE],
})
export class AdsStoresModule {}
