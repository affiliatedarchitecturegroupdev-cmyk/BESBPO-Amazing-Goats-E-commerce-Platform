import { PartnerDocument, PurchaseOrder, SlaughterSlot, scopeToOrg } from './partner-domain';

export const PARTNER_STORE = Symbol('PARTNER_STORE');

/** Persistence boundary for the partners schema; the SQL adapter lands with the store swap. */
export interface PartnerStore {
  slots(orgId: string): Promise<SlaughterSlot[]>;
  saveSlot(slot: SlaughterSlot): Promise<SlaughterSlot>;
  purchaseOrders(orgId: string): Promise<PurchaseOrder[]>;
  documents(orgId: string): Promise<PartnerDocument[]>;
}

/** In-memory store used by tests and local runs until the SQL adapter is wired. */
export class InMemoryPartnerStore implements PartnerStore {
  private readonly slotRows: SlaughterSlot[];
  private readonly poRows: PurchaseOrder[];
  private readonly docRows: PartnerDocument[];

  constructor(seed: { slots?: SlaughterSlot[]; purchaseOrders?: PurchaseOrder[]; documents?: PartnerDocument[] } = {}) {
    this.slotRows = seed.slots ?? [];
    this.poRows = seed.purchaseOrders ?? [];
    this.docRows = seed.documents ?? [];
  }

  async slots(orgId: string): Promise<SlaughterSlot[]> {
    return scopeToOrg(this.slotRows, orgId);
  }

  async saveSlot(slot: SlaughterSlot): Promise<SlaughterSlot> {
    const index = this.slotRows.findIndex((row) => row.id === slot.id);
    if (index >= 0) this.slotRows[index] = slot;
    else this.slotRows.push(slot);
    return slot;
  }

  async purchaseOrders(orgId: string): Promise<PurchaseOrder[]> {
    return scopeToOrg(this.poRows, orgId);
  }

  async documents(orgId: string): Promise<PartnerDocument[]> {
    return scopeToOrg(this.docRows, orgId);
  }
}

/** Demo rows for local runs, until the partners schema is loaded. */
export const DEMO_PARTNER_SEED = {
  slots: [
    { id: 'slot-mon', orgId: 'org-abattoir-1', date: 'Mon', capacity: 120, booked: 98, confirmed: false, halaal: true },
    { id: 'slot-tue', orgId: 'org-abattoir-1', date: 'Tue', capacity: 120, booked: 40, confirmed: false, halaal: true },
  ] satisfies SlaughterSlot[],
  purchaseOrders: [
    { id: 'po-118', orgId: 'org-farm-1', code: 'PO-118', description: '200 broilers', date: 'Wed', status: 'sent' },
  ] satisfies PurchaseOrder[],
  documents: [
    { id: 'doc-pack', orgId: 'org-abattoir-1', name: 'Pack station certificate', expiresOn: '2027-03-30' },
    { id: 'doc-halaal', orgId: 'org-abattoir-1', name: 'Halaal certificate', expiresOn: '2027-01-12' },
  ] satisfies PartnerDocument[],
};
