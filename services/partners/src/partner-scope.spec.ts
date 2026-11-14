import { describe, it, expect } from 'vitest';
import { partnerOrgId } from './partner-scope';

describe('partnerOrgId', () => {
  it('scopes a partner to their own org, ignoring any requested org', () => {
    const user = { id: 'u1', roles: ['procurement' as const], orgId: 'org-1' };
    expect(partnerOrgId(user, 'org-2')).toBe('org-1');
  });

  it('lets internal staff with no partner org read an explicit org', () => {
    const user = { id: 'u2', roles: ['procurement' as const] };
    expect(partnerOrgId(user, 'org-7')).toBe('org-7');
  });

  it('refuses an anonymous caller', () => {
    expect(() => partnerOrgId(undefined, 'org-1')).toThrow(/not signed in/);
  });

  it('refuses staff who do not name an org', () => {
    expect(() => partnerOrgId({ id: 'u3', roles: ['procurement' as const] })).toThrow(/no partner organisation/);
  });

  it('refuses a caller with no partner org and no procurement permission', () => {
    expect(() => partnerOrgId({ id: 'u4', roles: ['sales' as const] }, 'org-1')).toThrow(/no partner organisation/);
  });
});
