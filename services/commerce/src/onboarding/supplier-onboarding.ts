// Supplier onboarding for dairy and fresh produce (T-033). Bringing a dairy,
// produce or egg supplier onto the platform is a compliance check first and a
// commercial agreement second: docs/07-compliance.md names the rule sets and the
// documents each supplier kind must lodge. The checks are pure functions so the
// onboarding API, the admin screens and any batch re-check share one definition
// of "approved".
//
// The documents mirror `partners.documents` (kind, storage_url, expires_on,
// verified): an application here is the set of rows a partner has lodged.

export type SupplierKind = 'dairy' | 'produce' | 'eggs';

/** Document kinds a supplier may lodge; a subset of `partners.documents.kind`. */
export type SupplierDocumentKind =
  | 'dairy_approval'
  | 'r638_certificate_of_acceptability'
  | 'produce_grading_declaration'
  | 'egg_pack_station_registration'
  | 'cold_chain_attestation'
  | 'tax_clearance'
  | 'public_liability_insurance';

export interface SupplierRequirement {
  documentKind: SupplierDocumentKind;
  label: string;
  /** The rule set or authority the requirement rests on. */
  legalRef: string;
  /** Days before expiry at which the document should be renewed. */
  renewWithinDays?: number;
}

/**
 * The documents each supplier kind must lodge, grounded in docs/07-compliance.md:
 * dairy needs an approved dairy (R1510 of 2019, R1555 of 1997) and must not be
 * repacked; produce must be graded, packed and marked by the supplier (R364 of
 * 2013, R631 of 2018); eggs come only from a registered egg packing station
 * (R345 of 2020). All three need a Certificate of Acceptability (R638 of 2018).
 */
export const SUPPLIER_REQUIREMENTS: Record<SupplierKind, SupplierRequirement[]> = {
  dairy: [
    { documentKind: 'dairy_approval', label: 'Approved dairy (no repacking)', legalRef: 'R1510 of 2019; R1555 of 1997', renewWithinDays: 30 },
    { documentKind: 'r638_certificate_of_acceptability', label: 'Certificate of Acceptability', legalRef: 'R638 of 2018', renewWithinDays: 30 },
    { documentKind: 'cold_chain_attestation', label: 'Cold-chain attestation', legalRef: 'R638 of 2018' },
    { documentKind: 'tax_clearance', label: 'Tax clearance', legalRef: 'SARS', renewWithinDays: 60 },
  ],
  produce: [
    { documentKind: 'produce_grading_declaration', label: 'Graded, packed and marked by supplier', legalRef: 'R364 of 2013; R631 of 2018', renewWithinDays: 30 },
    { documentKind: 'r638_certificate_of_acceptability', label: 'Certificate of Acceptability', legalRef: 'R638 of 2018', renewWithinDays: 30 },
    { documentKind: 'cold_chain_attestation', label: 'Cold-chain attestation', legalRef: 'R638 of 2018' },
    { documentKind: 'tax_clearance', label: 'Tax clearance', legalRef: 'SARS', renewWithinDays: 60 },
  ],
  eggs: [
    { documentKind: 'egg_pack_station_registration', label: 'Registered egg packing station', legalRef: 'R345 of 2020', renewWithinDays: 30 },
    { documentKind: 'r638_certificate_of_acceptability', label: 'Certificate of Acceptability', legalRef: 'R638 of 2018', renewWithinDays: 30 },
    { documentKind: 'tax_clearance', label: 'Tax clearance', legalRef: 'SARS', renewWithinDays: 60 },
  ],
};

export interface SupplierDocument {
  kind: SupplierDocumentKind;
  reference: string;
  /** A person has checked the document against the issuing body. */
  verified: boolean;
  /** ISO date (YYYY-MM-DD). Omitted for documents that do not expire. */
  expiresOn?: string;
}

export interface SupplierApplication {
  orgName: string;
  kind: SupplierKind;
  documents: SupplierDocument[];
}

export type SupplierDecision = 'approved' | 'pending' | 'blocked';

export interface SupplierOnboardingResult {
  orgName: string;
  kind: SupplierKind;
  decision: SupplierDecision;
  /** Required documents that were never lodged. */
  missing: SupplierRequirement[];
  /** Lodged documents whose expiry has passed. */
  expired: SupplierDocument[];
  /** Lodged documents that a person has not yet verified. */
  unverified: SupplierDocument[];
  /** Verified documents nearing expiry, to chase for renewal. */
  expiringSoon: SupplierDocument[];
  notes: string[];
}

function asDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

/** Whole days from `asOf` until `expiresOn`; negative when already expired. */
export function daysUntilExpiry(expiresOn: string, asOf: Date): number {
  return Math.round((asDate(expiresOn).getTime() - asOf.getTime()) / 86_400_000);
}

/** True when a dated document is valid on `asOf` (expiry day still counts). */
export function isExpired(document: SupplierDocument, asOf: Date): boolean {
  return document.expiresOn !== undefined && daysUntilExpiry(document.expiresOn, asOf) < 0;
}

/**
 * Check a supplier application against its required documents.
 *
 * Decision: any expired document blocks onboarding (a lodged document that has
 * lapsed is a positive reason to refuse); an unverified document or a document
 * that was never lodged leaves the application pending; otherwise it is
 * approved.
 */
export function evaluateSupplierOnboarding(application: SupplierApplication, asOf: Date): SupplierOnboardingResult {
  const requirements = SUPPLIER_REQUIREMENTS[application.kind];
  const byKind = new Map<SupplierDocumentKind, SupplierDocument>();
  for (const document of application.documents) {
    if (!byKind.has(document.kind)) byKind.set(document.kind, document);
  }

  const missing = requirements.filter((r) => !byKind.has(r.documentKind));
  const lodged = requirements.flatMap((r) => {
    const document = byKind.get(r.documentKind);
    return document ? [{ requirement: r, document }] : [];
  });

  const expired = lodged.filter((l) => isExpired(l.document, asOf)).map((l) => l.document);
  const unverified = lodged.filter((l) => !l.document.verified && !isExpired(l.document, asOf)).map((l) => l.document);
  const expiringSoon = lodged
    .filter(
      (l) =>
        l.document.verified &&
        l.requirement.renewWithinDays !== undefined &&
        l.document.expiresOn !== undefined &&
        daysUntilExpiry(l.document.expiresOn, asOf) <= l.requirement.renewWithinDays,
    )
    .map((l) => l.document);

  const decision: SupplierDecision =
    expired.length > 0 ? 'blocked' : missing.length > 0 || unverified.length > 0 ? 'pending' : 'approved';

  const notes: string[] = [];
  if (missing.length > 0) notes.push(`${missing.length} required document(s) not lodged`);
  if (unverified.length > 0) notes.push(`${unverified.length} document(s) awaiting verification`);
  if (expired.length > 0) notes.push(`${expired.length} document(s) expired`);
  if (expiringSoon.length > 0) notes.push(`${expiringSoon.length} document(s) expiring soon`);

  return { orgName: application.orgName, kind: application.kind, decision, missing, expired, unverified, expiringSoon, notes };
}

/** A checklist for an admin screen: every required document and its state. */
export interface ChecklistItem extends SupplierRequirement {
  status: 'missing' | 'unverified' | 'expired' | 'expiring_soon' | 'valid';
  reference?: string;
  expiresOn?: string;
}

export function supplierChecklist(application: SupplierApplication, asOf: Date): ChecklistItem[] {
  const byKind = new Map<SupplierDocumentKind, SupplierDocument>();
  for (const document of application.documents) {
    if (!byKind.has(document.kind)) byKind.set(document.kind, document);
  }
  return SUPPLIER_REQUIREMENTS[application.kind].map((requirement) => {
    const document = byKind.get(requirement.documentKind);
    if (!document) return { ...requirement, status: 'missing' };
    const base = { ...requirement, reference: document.reference, expiresOn: document.expiresOn };
    if (isExpired(document, asOf)) return { ...base, status: 'expired' };
    if (!document.verified) return { ...base, status: 'unverified' };
    const expiring =
      requirement.renewWithinDays !== undefined &&
      document.expiresOn !== undefined &&
      daysUntilExpiry(document.expiresOn, asOf) <= requirement.renewWithinDays;
    return { ...base, status: expiring ? 'expiring_soon' : 'valid' };
  });
}
