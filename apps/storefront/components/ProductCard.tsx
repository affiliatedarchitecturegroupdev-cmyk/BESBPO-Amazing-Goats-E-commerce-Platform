import type { Variant } from '@ag/shared-types';
import { FulfilmentTag, Badges } from './FulfilmentTag';
import { AddToCartButton } from './AddToCartButton';
import { formatRandIncVat } from '../lib/format';
import { badgesFor, type StorefrontItem } from '../lib/catalog';

export function ProductCard({
  v,
  sponsored = false,
  redirectTo = '/cart',
}: {
  v: Variant | StorefrontItem;
  sponsored?: boolean;
  redirectTo?: string;
}) {
  const badges = 'category' in v ? badgesFor(v) : [];
  // A quote-only line has no price, so it cannot be added to the cart.
  const canAdd = v.priceCents != null && v.fulfilment !== 'quote';
  return (
    <article className="card product-card">
      {sponsored && <small>Sponsored</small>}
      <h3>{v.name}</h3>
      <p>{v.pack}</p>
      <FulfilmentTag type={v.fulfilment} />
      {badges.length > 0 && <Badges badges={badges} />}
      <p><strong>{v.priceCents != null ? formatRandIncVat(v.priceCents) : 'Price on request'}</strong></p>
      {canAdd && (
        <AddToCartButton
          item={{ sku: v.sku, name: v.name, fulfilment: v.fulfilment, temperature: v.temperature, priceCents: v.priceCents }}
          redirectTo={redirectTo}
        />
      )}
    </article>
  );
}
