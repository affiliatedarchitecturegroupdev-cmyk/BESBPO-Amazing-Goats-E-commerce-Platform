import type { PartnerDocument, PurchaseOrder, SlaughterSlot } from '@ag/api-client';

/**
 * Fixtures only (T-050): demo rows in the shape the gateway returns, so specs
 * can exercise the real mapping and rendering code without a running gateway.
 */
export const FIXTURE_SLOTS: SlaughterSlot[] = [
  { id: 'slot-mon', orgId: 'org-demo', date: 'Mon', capacity: 120, booked: 98, confirmed: false, halaal: true },
  { id: 'slot-tue', orgId: 'org-demo', date: 'Tue', capacity: 120, booked: 40, confirmed: false, halaal: true },
];

export const FIXTURE_ORDERS: PurchaseOrder[] = [
  { id: 'po-118', orgId: 'org-demo', code: 'PO-118', description: '200 broilers', date: 'Wed', status: 'sent' },
];

export const FIXTURE_DOCS: PartnerDocument[] = [
  { id: 'doc-pack', orgId: 'org-demo', name: 'Pack station certificate', expiresOn: '2027-03-30' },
  { id: 'doc-halaal', orgId: 'org-demo', name: 'Halaal certificate', expiresOn: '2027-01-12' },
];
