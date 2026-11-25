import { Module } from '@nestjs/common';
import { DispatchModule } from '../dispatch/dispatch.module';
import { NewsletterController } from './newsletter.controller';
import { NewsletterService, SUBSCRIBER_STORE, CAMPAIGN_STORE, IP_SALT, SITE_URL } from './newsletter.service';
import { InMemorySubscriberStore } from './subscriber';
import { InMemoryCampaignStore } from './campaign';

/**
 * The newsletter list and campaigns. The stores are in-memory behind the same
 * interfaces a SQL adapter would implement (`notifications.subscribers`,
 * `notifications.campaigns`, `notifications.campaign_sends`); `STORE_DRIVER=sql`
 * is where that adapter would be selected, in the same way dispatch and consent
 * select theirs.
 */
@Module({
  imports: [DispatchModule],
  controllers: [NewsletterController],
  providers: [
    NewsletterService,
    { provide: SUBSCRIBER_STORE, useFactory: () => new InMemorySubscriberStore() },
    { provide: CAMPAIGN_STORE, useFactory: () => new InMemoryCampaignStore() },
    // A salt that is not set still hashes; the value only needs to be stable per
    // deployment, and an unset salt is a misconfiguration to fix, not a crash.
    { provide: IP_SALT, useFactory: () => process.env.NEWSLETTER_IP_SALT ?? 'dev-salt' },
    { provide: SITE_URL, useFactory: () => process.env.SITE_URL ?? 'https://amazinggoats.store' },
  ],
})
export class NewsletterModule {}
