import { describe, it, expect } from 'vitest';
import {
  SUPPLIER_REQUIREMENTS,
  SupplierApplication,
  SupplierDocument,
  daysUntilExpiry,
  evaluateSupplierOnboarding,
  isExpired,
  supplierChecklist,
} from './supplier-onboarding';

const AS_OF = new Date('2026-05-04T00:00:00Z');

function dairyDoc(overrides: Partial<SupplierDocument> = {}): SupplierDocument {
  return { kind: 'dairy_approval', reference: 'D-1', verified: true, ...overrides };
}

/** A fully compliant dairy application, easy to break one document at a time. */
function completeDairy(): SupplierApplication {
  return {
    orgName: 'Rietfontein Dairy',
    kind: 'dairy',
    documents: [
      { kind: 'dairy_approval', reference: 'D-1', verified: true, expiresOn: '2027-01-01' },
      { kind: 'r638_certificate_of_acceptability', reference: 'C-1', verified: true, expiresOn: '2026-12-01' },
      { kind: 'cold_chain_attestation', reference: 'CC-1', verified: true },
      { kind: 'tax_clearance', reference: 'T-1', verified: true, expiresOn: '2026-08-01' },
    ],
  };
}

describe('requirements', () => {
  it('names the rule sets from docs/07-compliance.md', () => {
    const dairy = SUPPLIER_REQUIREMENTS.dairy.map((r) => r.documentKind);
    expect(dairy).toContain('dairy_approval');
    expect(dairy).toContain('r638_certificate_of_acceptability');
    const produce = SUPPLIER_REQUIREMENTS.produce.map((r) => r.documentKind);
    expect(produce).toContain('produce_grading_declaration');
    const eggs = SUPPLIER_REQUIREMENTS.eggs.map((r) => r.documentKind);
    expect(eggs).toContain('egg_pack_station_registration');
    expect(SUPPLIER_REQUIREMENTS.dairy.find((r) => r.documentKind === 'dairy_approval')?.legalRef).toContain('R1510');
  });
});

describe('expiry helpers', () => {
  it('measures whole days to expiry', () => {
    expect(daysUntilExpiry('2026-05-05', AS_OF)).toBe(1);
    expect(daysUntilExpiry('2026-05-04', AS_OF)).toBe(0);
    expect(daysUntilExpiry('2026-05-03', AS_OF)).toBe(-1);
  });

  it('treats the expiry day as still valid and undated documents as never expiring', () => {
    expect(isExpired(dairyDoc({ expiresOn: '2026-05-04' }), AS_OF)).toBe(false);
    expect(isExpired(dairyDoc({ expiresOn: '2026-05-03' }), AS_OF)).toBe(true);
    expect(isExpired(dairyDoc({ expiresOn: undefined }), AS_OF)).toBe(false);
  });
});

describe('evaluateSupplierOnboarding', () => {
  it('approves a complete, verified, in-date application', () => {
    const result = evaluateSupplierOnboarding(completeDairy(), AS_OF);
    expect(result.decision).toBe('approved');
    expect(result.missing).toHaveLength(0);
    expect(result.expired).toHaveLength(0);
    expect(result.unverified).toHaveLength(0);
  });

  it('stays pending when a required document was never lodged', () => {
    const application = completeDairy();
    application.documents = application.documents.filter((d) => d.kind !== 'cold_chain_attestation');
    const result = evaluateSupplierOnboarding(application, AS_OF);
    expect(result.decision).toBe('pending');
    expect(result.missing.map((r) => r.documentKind)).toEqual(['cold_chain_attestation']);
  });

  it('stays pending while a document is unverified', () => {
    const application = completeDairy();
    application.documents[1].verified = false;
    const result = evaluateSupplierOnboarding(application, AS_OF);
    expect(result.decision).toBe('pending');
    expect(result.unverified.map((d) => d.kind)).toEqual(['r638_certificate_of_acceptability']);
  });

  it('blocks onboarding when a lodged document has expired', () => {
    const application = completeDairy();
    application.documents[0].expiresOn = '2026-04-01';
    const result = evaluateSupplierOnboarding(application, AS_OF);
    expect(result.decision).toBe('blocked');
    expect(result.expired.map((d) => d.kind)).toEqual(['dairy_approval']);
  });

  it('flags verified documents that are nearing renewal', () => {
    const application = completeDairy();
    application.documents[3].expiresOn = '2026-05-20'; // tax clearance, renewWithinDays 30
    const result = evaluateSupplierOnboarding(application, AS_OF);
    expect(result.decision).toBe('approved');
    expect(result.expiringSoon.map((d) => d.kind)).toEqual(['tax_clearance']);
  });

  it('ignores duplicate documents of the same kind (first lodged wins)', () => {
    const application = completeDairy();
    application.documents.push({ kind: 'dairy_approval', reference: 'D-2', verified: false });
    const result = evaluateSupplierOnboarding(application, AS_OF);
    expect(result.decision).toBe('approved');
  });
});

describe('supplierChecklist', () => {
  it('reports each required document and its state', () => {
    const application = completeDairy();
    application.documents = application.documents.filter((d) => d.kind !== 'cold_chain_attestation');
    application.documents[1].verified = false;
    const checklist = supplierChecklist(application, AS_OF);
    const byKind = new Map(checklist.map((item) => [item.documentKind, item.status]));
    expect(byKind.get('dairy_approval')).toBe('valid');
    expect(byKind.get('r638_certificate_of_acceptability')).toBe('unverified');
    expect(byKind.get('cold_chain_attestation')).toBe('missing');
  });
});
