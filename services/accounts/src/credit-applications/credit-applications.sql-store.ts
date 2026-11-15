import type { Db } from '@ag/db';
import { currentSession, toCents } from '@ag/db';
import {
  ApplicationStatus,
  BusinessType,
  CreditApplication,
  DocumentKind,
} from './credit-application.rules';
import { CreditApplicationsStore } from './credit-applications.store';

interface ApplicationRow {
  id: string;
  org_id: string | null;
  business_type: string | null;
  registration_number: string | null;
  turnover_declared_cents: string | number | null;
  est_weekly_spend_cents: string | number | null;
  requested_limit_cents: string | number | null;
  requested_terms_days: number | null;
  consent_given: boolean;
  submitted_at: string | Date;
  decision: string | null;
  decided_by: string | null;
  second_approver: string | null;
  decided_at: string | Date | null;
  decision_reason: string | null;
}

interface DocumentRow {
  kind: string;
  storage_url: string;
  verified: boolean;
  expires_on: string | Date | null;
}

const COLUMNS =
  'id, org_id, business_type, registration_number, turnover_declared_cents, est_weekly_spend_cents, requested_limit_cents, requested_terms_days, consent_given, submitted_at, decision, decided_by, second_approver, decided_at, decision_reason';

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function toDate(value: string | Date | null): string | undefined {
  if (value === null) return undefined;
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
}

function toStatus(decision: string | null): ApplicationStatus {
  if (decision === 'approved' || decision === 'rejected') return decision;
  return 'submitted';
}

function toApplication(row: ApplicationRow, documents: DocumentRow[]): CreditApplication {
  return {
    id: row.id,
    orgId: row.org_id ?? '',
    businessType: (row.business_type ?? 'trader') as BusinessType,
    registrationNumber: row.registration_number ?? '',
    turnoverDeclaredCents: toCents(row.turnover_declared_cents ?? 0),
    estWeeklySpendCents: toCents(row.est_weekly_spend_cents ?? 0),
    requestedLimitCents: toCents(row.requested_limit_cents ?? 0),
    requestedTermsDays: row.requested_terms_days ?? 0,
    documents: documents.map((d) => ({
      kind: d.kind as DocumentKind,
      storageUrl: d.storage_url,
      verified: d.verified,
      expiresOn: toDate(d.expires_on),
    })),
    consentGiven: row.consent_given,
    status: toStatus(row.decision),
    // NCA review is derived from turnover, so it is recomputed on read rather
    // than stored twice.
    ncaReview: toCents(row.turnover_declared_cents ?? 0) < 100_000_000,
    submittedAt: toIso(row.submitted_at),
    decidedBy: row.decided_by ?? undefined,
    secondApprover: row.second_approver ?? undefined,
    decidedAt: row.decided_at ? toIso(row.decided_at) : undefined,
    decisionReason: row.decision_reason ?? undefined,
  };
}

/**
 * SQL adapter over `accounts.credit_applications` and its uploaded documents in
 * `accounts.documents`; every query runs in an RLS session.
 */
export class PgCreditApplicationsStore implements CreditApplicationsStore {
  constructor(private readonly db: Db) {}

  private async documentsFor(orgIds: string[]): Promise<Map<string, DocumentRow[]>> {
    const byOrg = new Map<string, DocumentRow[]>();
    if (orgIds.length === 0) return byOrg;
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<DocumentRow & { org_id: string }>(
        `SELECT org_id, kind, storage_url, verified, expires_on
           FROM accounts.documents WHERE org_id = ANY($1) ORDER BY kind`,
        [orgIds],
      ),
    );
    for (const row of rows) {
      const list = byOrg.get(row.org_id) ?? [];
      list.push(row);
      byOrg.set(row.org_id, list);
    }
    return byOrg;
  }

  async all(): Promise<CreditApplication[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ApplicationRow>(`SELECT ${COLUMNS} FROM accounts.credit_applications ORDER BY submitted_at DESC`),
    );
    const documents = await this.documentsFor(rows.map((r) => r.org_id ?? '').filter(Boolean));
    return rows.map((row) => toApplication(row, documents.get(row.org_id ?? '') ?? []));
  }

  async get(id: string): Promise<CreditApplication | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ApplicationRow>(`SELECT ${COLUMNS} FROM accounts.credit_applications WHERE id = $1`, [id]),
    );
    if (!rows[0]) return undefined;
    const documents = await this.documentsFor([rows[0].org_id ?? '']);
    return toApplication(rows[0], documents.get(rows[0].org_id ?? '') ?? []);
  }

  async insert(application: CreditApplication): Promise<CreditApplication> {
    await this.db.withSession(currentSession(), async (tx) => {
      await tx.query(
        `INSERT INTO accounts.credit_applications
           (id, org_id, business_type, registration_number, turnover_declared_cents, est_weekly_spend_cents,
            requested_limit_cents, requested_terms_days, consent_given, submitted_at, decision)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          application.id,
          application.orgId || null,
          application.businessType,
          application.registrationNumber,
          application.turnoverDeclaredCents,
          application.estWeeklySpendCents,
          application.requestedLimitCents,
          application.requestedTermsDays,
          application.consentGiven,
          application.submittedAt,
          application.status,
        ],
      );
      await this.replaceDocuments(tx, application.orgId, application);
    });
    return application;
  }

  async replace(application: CreditApplication): Promise<CreditApplication> {
    await this.db.withSession(currentSession(), async (tx) => {
      const { rows } = await tx.query(
        `UPDATE accounts.credit_applications
            SET decision = $2, decided_by = $3, second_approver = $4, decided_at = $5, decision_reason = $6
          WHERE id = $1 RETURNING id`,
        [
          application.id,
          application.status,
          application.decidedBy ?? null,
          application.secondApprover ?? null,
          application.decidedAt ?? null,
          application.decisionReason ?? null,
        ],
      );
      if (rows.length === 0) throw new Error(`application ${application.id} not found`);
    });
    return application;
  }

  private async replaceDocuments(tx: Db, orgId: string, application: CreditApplication): Promise<void> {
    if (!orgId) return;
    await tx.query(`DELETE FROM accounts.documents WHERE org_id = $1`, [orgId]);
    for (const document of application.documents) {
      await tx.query(
        `INSERT INTO accounts.documents (org_id, kind, storage_url, verified, expires_on)
         VALUES ($1, $2, $3, $4, $5)`,
        [orgId, document.kind, document.storageUrl, document.verified, document.expiresOn ?? null],
      );
    }
  }
}
