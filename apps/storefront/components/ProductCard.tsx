import type { Variant } from '@ag/shared-types';
import { FulfilmentTag, Badges } from './FulfilmentTag';
import { formatRand } from '../lib/format';
import { badgesFor, type StorefrontItem } from '../lib/catalog';

export function ProductCard({ v, sponsored = false }: { v: Variant | StorefrontItem; sponsored?: boolean }) {
  const badges = 'category' in v ? badgesFor(v) : [];
  return (
    <article className="card product-card">
      {sponsored && <small>Sponsored</small>}
      <h3>{v.name}</h3>
      <p>{v.pack}</p>
      <FulfilmentTag type={v.fulfilment} />
      {badges.length > 0 && <Badges badges={badges} />}
      <p><strong>{v.priceCents != null ? formatRand(v.priceCents) : 'Price on request'}</strong></p>
    </article>
  );
}
