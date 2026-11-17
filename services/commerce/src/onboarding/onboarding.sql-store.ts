import type { Db } from '@ag/db';
import { currentSession } from '@ag/db';
import { SupplierApplicationStore } from './onboarding.service';
import { SupplierApplication, SupplierKind } from './supplier-onboarding';

interface ApplicationRow {
  org_name: string;
  kind: SupplierKind;
  documents: SupplierApplication['documents'] | null;
}

function toApplication(row: ApplicationRow): SupplierApplication {
  return { orgName: row.org_name, kind: row.kind, documents: row.documents ?? [] };
}

/**
 * SQL adapter over `partners.supplier_applications`. The organisation name is the
 * domain key and the primary key; the lodged documents are edited wholesale, so
 * they are stored as a jsonb payload. Onboarding is a staff workflow, so the
 * table's RLS policy shows the rows to a staff session only.
 */
export class PgSupplierApplicationStore implements SupplierApplicationStore {
  constructor(private readonly db: Db) {}

  async all(): Promise<SupplierApplication[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ApplicationRow>(
        `SELECT org_name, kind, documents FROM partners.supplier_applications ORDER BY org_name`,
      ),
    );
    return rows.map(toApplication);
  }

  async upsert(application: SupplierApplication): Promise<SupplierApplication> {
    await this.db.withSession(currentSession(), (tx) =>
      tx.query(
        `INSERT INTO partners.supplier_applications (org_name, kind, documents)
         VALUES ($1, $2, $3)
         ON CONFLICT (org_name) DO UPDATE SET
           kind = EXCLUDED.kind, documents = EXCLUDED.documents, updated_at = now()`,
        [application.orgName, application.kind, JSON.stringify(application.documents)],
      ),
    );
    return application;
  }
}
