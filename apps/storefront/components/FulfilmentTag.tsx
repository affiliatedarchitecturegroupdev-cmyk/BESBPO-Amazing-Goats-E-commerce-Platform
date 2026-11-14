import type { FulfilmentType } from '@ag/shared-types';
const LABEL: Record<FulfilmentType, string> = { in_stock: 'In stock', pre_order_cycle: 'Pre-order', reservation: 'Reserve', quote: 'Quote', seasonal_pre_order: 'Seasonal pre-order' };
export function FulfilmentTag({ type, detail }: { type: FulfilmentType; detail?: string }) {
  return <span className="tag">{LABEL[type]}{detail ? ` · ${detail}` : ''}</span>;
}
