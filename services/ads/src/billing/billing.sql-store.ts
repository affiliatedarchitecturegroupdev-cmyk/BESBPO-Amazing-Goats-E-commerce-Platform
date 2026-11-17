import type { Db } from '@ag/db';
import { currentSession, toCents, toIso } from '@ag/db';
import { WalletEntry, WalletKind, WalletMovement } from './wallet.rules';
import { BillingStore } from './billing.store';

interface LedgerRow {
  id: string | number;
  advertiser_org: string;
  kind: WalletKind;
  amount_cents: string | number;
  ref: string | null;
  at: Date | string;
}

function toEntry(row: LedgerRow): WalletEntry {
  return {
    id: `wl_${row.id}`,
    advertiserOrgId: row.advertiser_org,
    kind: row.kind,
    amountCents: toCents(row.amount_cents),
    ref: row.ref ?? undefined,
    at: toIso(row.at),
  };
}

// The advertiser is a domain organisation id carried in `advertiser_org_ref`; the
// uuid column is resolved from `identity.orgs` on write, for the RLS policy.
const COLUMNS = `l.id, COALESCE(l.advertiser_org_ref, l.advertiser_org_id::text) AS advertiser_org,
  l.kind, l.amount_cents, l.ref, l.at`;

/**
 * SQL adapter over `ads.wallet_ledger`. The ledger is append-only: `append`
 * inserts one signed movement and `ledger` reads the advertiser's rows oldest
 * first, which is the order the balance is summed in.
 */
export class PgBillingStore implements BillingStore {
  constructor(private readonly db: Db) {}

  async ledger(advertiserOrgId: string): Promise<WalletEntry[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<LedgerRow>(
        `SELECT ${COLUMNS} FROM ads.wallet_ledger l
          WHERE COALESCE(l.advertiser_org_ref, l.advertiser_org_id::text) = $1
          ORDER BY l.id`,
        [advertiserOrgId],
      ),
    );
    return rows.map(toEntry);
  }

  async append(movement: WalletMovement): Promise<WalletEntry> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<LedgerRow>(
        `WITH inserted AS (
           INSERT INTO ads.wallet_ledger
             (advertiser_org_id, advertiser_org_ref, kind, amount_cents, ref, at)
           VALUES ((SELECT id FROM identity.orgs WHERE external_id = $1), $1, $2, $3, $4, $5)
           RETURNING *
         )
         SELECT ${COLUMNS} FROM inserted l`,
        [
          movement.advertiserOrgId,
          movement.kind,
          movement.amountCents,
          movement.ref ?? null,
          movement.at,
        ],
      ),
    );
    return toEntry(rows[0]);
  }
}
