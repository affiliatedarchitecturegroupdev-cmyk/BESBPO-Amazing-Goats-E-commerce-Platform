import type { Db } from '@ag/db';
import { currentSession } from '@ag/db';
import { PartnerDocument, PurchaseOrder, SlaughterSlot } from './partner-domain';
import { PartnerStore } from './partner.store';

interface SlotRow {
  external_id: string;
  partner_org_ref: string;
  day_label: string;
  capacity: number;
  booked: number;
  confirmed: boolean;
  halaal: boolean;
}

interface PurchaseOrderRow {
  external_id: string;
  partner_org_ref: string;
  code: string;
  description: string;
  day_label: string;
  status: PurchaseOrder['status'];
  grades: string | null;
}

interface DocumentRow {
  external_id: string;
  partner_org_ref: string;
  name: string;
  expires_on: Date | string | null;
}

/** A `date` column to a `YYYY-MM-DD` string. */
function toDate(value: Date | string | null): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value === null ? '' : String(value).slice(0, 10);
}

function toSlot(row: SlotRow): SlaughterSlot {
  return {
    id: row.external_id,
    orgId: row.partner_org_ref,
    date: row.day_label,
    capacity: row.capacity,
    booked: row.booked,
    confirmed: row.confirmed,
    halaal: row.halaal,
  };
}

function toPurchaseOrder(row: PurchaseOrderRow): PurchaseOrder {
  return {
    id: row.external_id,
    orgId: row.partner_org_ref,
    code: row.code,
    description: row.description,
    date: row.day_label,
    status: row.status,
    grades: row.grades ?? undefined,
  };
}

function toDocument(row: DocumentRow): PartnerDocument {
  return {
    id: row.external_id,
    orgId: row.partner_org_ref,
    name: row.name,
    expiresOn: toDate(row.expires_on),
  };
}

/**
 * SQL adapter over `partners.slots`, `partners.purchase_orders` and
 * `partners.documents`. The domain carries string ids and organisation domain
 * ids, so `external_id`/`partner_org_ref` hold them and the RLS policy scopes a
 * row to the owning organisation (by uuid or domain id). Every query runs in a
 * session, so a partner sees only their own org's rows.
 */
export class PgPartnerStore implements PartnerStore {
  constructor(private readonly db: Db) {}

  async slots(orgId: string): Promise<SlaughterSlot[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<SlotRow>(
        `SELECT external_id, partner_org_ref, day_label, capacity, booked, confirmed, halaal
           FROM partners.slots WHERE partner_org_ref = $1`,
        [orgId],
      ),
    );
    return rows.map(toSlot);
  }

  async saveSlot(slot: SlaughterSlot): Promise<SlaughterSlot> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<SlotRow>(
        `INSERT INTO partners.slots
           (external_id, partner_org_id, partner_org_ref, day_label, capacity, booked, confirmed, halaal)
         VALUES ($1, (SELECT id FROM identity.orgs WHERE external_id = $2), $2, $3, $4, $5, $6, $7)
         ON CONFLICT (external_id) DO UPDATE SET
           capacity = EXCLUDED.capacity, booked = EXCLUDED.booked,
           confirmed = EXCLUDED.confirmed, halaal = EXCLUDED.halaal,
           day_label = EXCLUDED.day_label
         RETURNING external_id, partner_org_ref, day_label, capacity, booked, confirmed, halaal`,
        [
          slot.id,
          slot.orgId,
          slot.date,
          slot.capacity,
          slot.booked,
          slot.confirmed,
          slot.halaal,
        ],
      ),
    );
    return toSlot(rows[0]);
  }

  async purchaseOrders(orgId: string): Promise<PurchaseOrder[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<PurchaseOrderRow>(
        `SELECT external_id, partner_org_ref, code, description, day_label, status, grades
           FROM partners.purchase_orders WHERE partner_org_ref = $1`,
        [orgId],
      ),
    );
    return rows.map(toPurchaseOrder);
  }

  async documents(orgId: string): Promise<PartnerDocument[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<DocumentRow>(
        `SELECT external_id, partner_org_ref, name, expires_on
           FROM partners.documents WHERE partner_org_ref = $1`,
        [orgId],
      ),
    );
    return rows.map(toDocument);
  }
}
