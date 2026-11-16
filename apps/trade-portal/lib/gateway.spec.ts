import { describe, it, expect } from 'vitest';
import { toApplicationInput } from './gateway';
import { DEMO_APPLICATION } from './fixtures';

describe('toApplicationInput', () => {
  it('maps the portal form onto the accounts application shape', () => {
    const input = toApplicationInput(DEMO_APPLICATION, 'org-7');
    expect(input.orgId).toBe('org-7');
    expect(input.businessType).toBe('butchery');
    expect(input.registrationNumber).toBe('2019/123456/07');
    expect(input.estWeeklySpendCents).toBe(65); // 5 + 40 + 20
    expect(input.requestedLimitCents).toBe(5_000_000);
    expect(input.consentGiven).toBe(true);
    expect(input.documents).toContainEqual({ kind: 'bank_letter', state: 'missing' });
  });

  it('defaults an empty business type to retail', () => {
    const input = toApplicationInput({ ...DEMO_APPLICATION, businessType: '' }, 'org-7');
    expect(input.businessType).toBe('retail');
  });
});
