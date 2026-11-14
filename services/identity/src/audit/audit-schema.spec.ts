import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The append-only rule is enforced in the database by triggers on the audit
 * tables. There is no Postgres in unit tests, so assert the migration that
 * carries that rule still does, guarding it against a silent edit.
 */
const migration = readFileSync(
  resolve(process.cwd(), '../../db/migrations/0001_extensions_audit.sql'),
  'utf8',
);

describe('audit schema (0001_extensions_audit.sql)', () => {
  it('defines the append-only log and the data-access log', () => {
    expect(migration).toMatch(/CREATE TABLE audit\.audit_log/);
    expect(migration).toMatch(/CREATE TABLE audit\.data_access_log/);
  });

  it('raises on any update or delete of an audit table', () => {
    expect(migration).toMatch(/block_mutation\(\)[\s\S]*RAISE EXCEPTION 'audit tables are append-only'/);
  });

  it('wires the immutability trigger to both audit tables', () => {
    expect(migration).toMatch(/CREATE TRIGGER audit_log_immutable BEFORE UPDATE OR DELETE ON audit\.audit_log/);
    expect(migration).toMatch(/CREATE TRIGGER data_access_immutable BEFORE UPDATE OR DELETE ON audit\.data_access_log/);
  });

  it('records who acted, on what, and any approver', () => {
    for (const column of ['actor_user_id', 'actor_roles', 'action', 'entity', 'before', 'after', 'approved_by']) {
      expect(migration).toContain(column);
    }
  });
});
