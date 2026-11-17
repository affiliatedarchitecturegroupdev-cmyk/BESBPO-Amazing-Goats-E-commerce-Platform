import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { CAMPAIGNS_STORE } from './campaigns/campaigns.service';
import { CREATIVES_STORE } from './creatives/creatives.service';
import { CampaignsStore, InMemoryCampaignsStore } from './campaigns/campaigns.store';
import { CreativesStore, InMemoryCreativesStore } from './creatives/creatives.store';
import { PgCampaignsStore } from './campaigns/campaigns.sql-store';
import { PgCreativesStore } from './creatives/creatives.sql-store';

/**
 * The one place the ads stores are built, so campaigns, creatives and
 * decisioning share the same instances. The in-memory stores are the default;
 * `STORE_DRIVER=sql` selects the SQL adapters over the `ads` schema.
 */
@Module({
  providers: [
    {
      provide: CAMPAIGNS_STORE,
      useFactory: (db?: Db) =>
        selectStore<CampaignsStore>(new InMemoryCampaignsStore(), () => new PgCampaignsStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
    {
      provide: CREATIVES_STORE,
      useFactory: (db?: Db) =>
        selectStore<CreativesStore>(new InMemoryCreativesStore(), () => new PgCreativesStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
  exports: [CAMPAIGNS_STORE, CREATIVES_STORE],
})
export class AdsStoresModule {}
