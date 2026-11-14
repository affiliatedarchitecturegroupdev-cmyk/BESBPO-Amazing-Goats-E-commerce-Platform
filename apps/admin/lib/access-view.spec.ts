import { describe, it, expect } from 'vitest';
import { CAPABILITIES, cellFor, needsSecondApprover, roleLabel, roleMatrix } from './access-view';

describe('roleLabel', () => {
  it('turns a role key into a readable label', () => {
    expect(roleLabel('chief_admin')).toBe('Chief admin');
    expect(roleLabel('ops_manager')).toBe('Ops manager');
    expect(roleLabel('finance')).toBe('Finance');
  });
});

describe('cellFor', () => {
  const orders = CAPABILITIES.find((c) => c.key === 'orders')!;
  const pricing = CAPABILITIES.find((c) => c.key === 'pricing')!;
  const pii = CAPABILITIES.find((c) => c.key === 'pii')!;

  it('marks write+approve for the executive on pricing', () => {
    expect(cellFor('executive', pricing)).toBe('A');
  });
  it('marks write for ops on orders', () => {
    expect(cellFor('ops_manager', orders)).toBe('W');
  });
  it('marks read only for a driver with no orders permission', () => {
    expect(cellFor('driver', orders)).toBe('');
  });
  it('marks read for pii where only read is granted', () => {
    expect(cellFor('sales', pii)).toBe('R');
  });
});

describe('roleMatrix', () => {
  it('renders one row per requested role with a cell per capability', () => {
    const rows = roleMatrix(['chief_admin', 'driver']);
    expect(rows).toHaveLength(2);
    expect(rows[0].cells).toHaveLength(CAPABILITIES.length);
    expect(rows[0].label).toBe('Chief admin');
  });

  it('gives the chief administrator write everywhere the matrix does', () => {
    const chief = roleMatrix(['chief_admin'])[0];
    expect(chief.cells.every((c) => c !== '')).toBe(true);
  });
});

describe('needsSecondApprover', () => {
  it('is true for roles that can manage roles', () => {
    expect(needsSecondApprover('chief_admin')).toBe(true);
  });
  it('is false for a driver', () => {
    expect(needsSecondApprover('driver')).toBe(false);
  });
});
