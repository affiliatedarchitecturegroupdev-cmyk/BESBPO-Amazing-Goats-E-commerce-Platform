import type { FulfilmentType } from '@ag/shared-types';
import type { Badge } from '../lib/catalog';
import type { ServedAd } from '../lib/placements';
const LABEL: Record<FulfilmentType, string> = { in_stock: 'In stock', pre_order_cycle: 'Pre-order', reservation: 'Reserve', quote: 'Quote', seasonal_pre_order: 'Seasonal pre-order' };
export function FulfilmentTag({ type, detail }: { type: FulfilmentType; detail?: string }) {
  return <span className="tag">{LABEL[type]}{detail ? ` · ${detail}` : ''}</span>;
}

const BADGE_LABEL: Record<Badge, string> = {
  farm_direct: 'Farm direct',
  halaal: 'Halaal option',
  low_stock: 'Low stock',
  special: 'Special',
  sponsored: 'Sponsored',
};

/** Small merchandising badges shown on a card. */
export function Badges({ badges }: { badges: Badge[] }) {
  if (badges.length === 0) return null;
  return (
    <span className="badges">
      {badges.map((b) => <span key={b} className={b === 'sponsored' ? 'tag ad' : 'tag'}>{BADGE_LABEL[b]}</span>)}
    </span>
  );
}

/** A retail-media slot. Every ad must be labelled Sponsored (docs/06-ads.md). */
export function SponsoredSlot({ slot, children }: { slot: string; children: React.ReactNode }) {
  return (
    <div className="ad" data-slot={slot}>
      <span className="tag ad">Sponsored</span>
      {children}
    </div>
  );
}

/**
 * A served ad from the decisioning endpoint. The label is the one the service
 * set, so a caller cannot render an ad without it; the whole thing links to the
 * ad's destination when it has one.
 */
export function ServedAdSlot({ ad }: { ad: ServedAd }) {
  const body = (
    <div className="ad" data-slot={ad.slot} data-creative={ad.creativeId}>
      <span className="tag ad">{ad.label}</span>
      {ad.headline ? <strong>{ad.headline}</strong> : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {/* Explicit dimensions reserve the box before the creative loads, so a slow
          ad image cannot shift the page under a thumb (T-080). */}
      <img src={ad.assetUrl} alt={ad.headline ?? ad.label} width={728} height={90} style={{ height: 'auto', maxWidth: '100%' }} />
    </div>
  );
  return ad.destinationUrl ? <a href={ad.destinationUrl}>{body}</a> : body;
}
