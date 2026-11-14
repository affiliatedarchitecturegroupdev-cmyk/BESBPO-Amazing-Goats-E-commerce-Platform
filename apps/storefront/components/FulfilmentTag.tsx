import type { FulfilmentType } from '@ag/shared-types';
import type { Badge } from '../lib/catalog';
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
