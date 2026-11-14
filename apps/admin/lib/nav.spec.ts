import { describe, it, expect } from 'vitest';
import { canAny } from '@ag/rbac';
import { NAV } from './nav';

describe('admin navigation', () => {
  it('hides roles and audit from drivers and shows everything to the chief admin', () => {
    const driver = NAV.filter((n) => canAny(['driver'], n.needs));
    expect(driver.length).toBe(0);
    expect(NAV.filter((n) => canAny(['chief_admin'], n.needs)).length).toBe(NAV.length);
  });
});
