import { describe, it, expect } from 'vitest';
import { canAny } from '@ag/rbac';
import { NAV, navFor } from './nav';

describe('admin navigation', () => {
  it('hides roles and audit from drivers and shows everything to the chief admin', () => {
    const driver = NAV.filter((n) => canAny(['driver'], n.needs));
    expect(driver.length).toBe(0);
    expect(NAV.filter((n) => canAny(['chief_admin'], n.needs)).length).toBe(NAV.length);
  });

  it('gives an operations manager only the entries they may use', () => {
    const hrefs = navFor(['ops_manager']).map((n) => n.href);
    expect(hrefs).toContain('/orders');
    expect(hrefs).toContain('/cycles');
    expect(hrefs).toContain('/batches');
    expect(hrefs).not.toContain('/payments');
    expect(hrefs).not.toContain('/roles');
  });

  it('gives a driver no admin menu at all', () => {
    expect(navFor(['driver'])).toEqual([]);
  });

  it('combines two roles into the union of their entries', () => {
    const sales = navFor(['sales']).map((n) => n.href);
    const finance = navFor(['finance']).map((n) => n.href);
    const both = navFor(['sales', 'finance']).map((n) => n.href);
    expect(new Set(both)).toEqual(new Set([...sales, ...finance]));
  });
});
