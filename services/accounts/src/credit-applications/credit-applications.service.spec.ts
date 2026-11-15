import { describe, it, expect } from 'vitest';
import { CreditApplicationsService } from './credit-applications.service';
import { InMemoryCreditApplicationsStore } from './credit-applications.store';
import type { ApplicationInput } from './credit-application.rules';

const input = (overrides: Partial<ApplicationInput> = {}): ApplicationInput => ({
  orgId: 'org-1',
  businessType: 'restaurant',
  registrationNumber: '2020/654321/07',
  turnoverDeclaredCents: 2_000_000_000,
  estWeeklySpendCents: 800_000,
  requestedLimitCents: 5_000_000,
  requestedTermsDays: 14,
  documents: [
    { kind: 'company_registration', storageUrl: 'u1', verified: true },
    { kind: 'vat_certificate', storageUrl: 'u2', verified: true },
    { kind: 'certificate_of_acceptability', storageUrl: 'u3', verified: true },
    { kind: 'bank_letter', storageUrl: 'u4', verified: true },
  ],
  consentGiven: true,
  ...overrides,
});

function service() {
  return new CreditApplicationsService(new InMemoryCreditApplicationsStore());
}

describe('CreditApplicationsService', () => {
  it('starts empty', async () => {
    expect(await service().list()).toEqual([]);
  });

  it('submits a complete application', async () => {
    const app = await service().submit(input());
    expect(app.status).toBe('submitted');
    expect(app.id).toBeTruthy();
  });

  it('approves a small limit in one step', async () => {
    const svc = service();
    const app = await svc.submit(input());
    const approved = await svc.approve(app.id, 'user-1');
    expect(approved.status).toBe('approved');
  });

  it('holds a large limit until a second approver, then approves', async () => {
    const svc = service();
    const app = await svc.submit(input({ requestedLimitCents: 50_000_000 }));
    const first = await svc.approve(app.id, 'user-1');
    expect(first.status).toBe('submitted');
    const second = await svc.secondApproval(app.id, 'user-2');
    expect(second.status).toBe('approved');
    expect(second.secondApprover).toBe('user-2');
  });

  it('rejects an unknown application', async () => {
    await expect(service().get('nope')).rejects.toThrow(/unknown application/);
  });
});
