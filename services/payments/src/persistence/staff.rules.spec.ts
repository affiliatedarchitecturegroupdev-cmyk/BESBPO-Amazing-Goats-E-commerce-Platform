import { describe, it, expect } from 'vitest';
import { isStaff } from './staff.rules';

describe('isStaff', () => {
  it('treats an internal role as staff, so it can see every org', () => {
    expect(isStaff(['finance'])).toBe(true);
    expect(isStaff(['ops_manager'])).toBe(true);
  });

  it('treats an external role as not staff, so it is scoped to its org', () => {
    expect(isStaff(['customer_household'])).toBe(false);
    expect(isStaff(['partner_user'])).toBe(false);
    expect(isStaff(['trade_buyer'])).toBe(false);
  });

  it('is not staff when the caller has no roles (default-deny)', () => {
    expect(isStaff([])).toBe(false);
  });

  it('is not staff when any role is external, even alongside an internal one', () => {
    expect(isStaff(['finance', 'customer_household'])).toBe(false);
  });
});
