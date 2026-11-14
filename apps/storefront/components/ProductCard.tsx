import type { Variant } from '@ag/shared-types';
import { FulfilmentTag } from './FulfilmentTag';
import { formatRand } from '../lib/format';

export function ProductCard({ v, sponsored = false }: { v: Variant; sponsored?: boolean }) {
  return (
    <article className="card">
      {sponsored && <small>Sponsored</small>}
      <h3>{v.name}</h3>
      <p>{v.pack}</p>
      <FulfilmentTag type={v.fulfilment} />
      <p><strong>{v.priceCents != null ? formatRand(v.priceCents) : 'Price on request'}</strong></p>
    </article>
  );
}
