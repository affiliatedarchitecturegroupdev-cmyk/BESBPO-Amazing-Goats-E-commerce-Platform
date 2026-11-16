import { describe, it, expect } from 'vitest';
import { InMemorySupplierApplicationStore, OnboardingService } from './onboarding.service';
import { SupplierApplication } from './supplier-onboarding';

const AS_OF = new Date('2026-05-04T00:00:00Z');

const dairy: SupplierApplication = {
  orgName: 'Rietfontein Dairy',
  kind: 'dairy',
  documents: [
    { kind: 'dairy_approval', reference: 'D-1', verified: true, expiresOn: '2027-01-01' },
    { kind: 'r638_certificate_of_acceptability', reference: 'C-1', verified: true, expiresOn: '2026-12-01' },
    { kind: 'cold_chain_attestation', reference: 'CC-1', verified: true },
    { kind: 'tax_clearance', reference: 'T-1', verified: true, expiresOn: '2026-08-01' },
  ],
};

function service(seed: SupplierApplication[] = []): OnboardingService {
  return new OnboardingService(new InMemorySupplierApplicationStore(seed));
}

describe('OnboardingService', () => {
  it('lists the requirements for a supplier kind', () => {
    const kinds = service().requirements('produce').map((r) => r.documentKind);
    expect(kinds).toContain('produce_grading_declaration');
  });

  it('rejects an unknown supplier kind', () => {
    expect(() => service().requirements('beef')).toThrow(/unknown supplier kind/);
  });

  it('lodge then approve a complete application', async () => {
    const svc = service();
    const result = await svc.submit(dairy, AS_OF);
    expect(result.decision).toBe('approved');
    const listed = await svc.list(AS_OF);
    expect(listed).toHaveLength(1);
    expect(listed[0].orgName).toBe('Rietfontein Dairy');
  });

  it('exposes the checklist for a lodged application', async () => {
    const svc = service([dairy]);
    const checklist = await svc.checklist('Rietfontein Dairy', AS_OF);
    expect(checklist.every((item) => item.status === 'valid')).toBe(true);
  });

  it('404s a checklist for an unknown supplier', async () => {
    await expect(service().checklist('Nobody', AS_OF)).rejects.toThrow(/unknown supplier/);
  });

  it('serves upcoming produce cycles and the next open one', () => {
    const svc = service();
    const now = new Date('2026-05-04T12:00:00Z');
    expect(svc.produceCycles(now, 2)).toHaveLength(2);
    expect(svc.nextProduceCycle(now)?.routeDay.toISOString()).toBe('2026-05-08T05:00:00.000Z');
  });
});
