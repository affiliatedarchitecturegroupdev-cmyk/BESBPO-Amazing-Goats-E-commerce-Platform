#!/usr/bin/env node
/**
 * Sync the role → permission mapping in packages/rbac to the database
 * (task T-004). Code is the source of truth.
 *
 *   node scripts/sync-rbac.mjs            apply the mapping (idempotent)
 *   node scripts/sync-rbac.mjs --check    report drift, change nothing
 *
 * Reads DATABASE_URL (default postgres://ag:ag@localhost:5432/ag). Writes the
 * generated SQL to stdout so it can also be piped to psql.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../packages/rbac/dist/index.js');
if (!existsSync(dist)) {
  console.error('build packages/rbac first: pnpm --filter @ag/rbac build');
  process.exit(2);
}
const { rolePermissionSyncSql, rolePermissionPairs, diffRolePermissions } = await import(dist);

const check = process.argv.includes('--check');

if (check) {
  const { Client } = await import('pg').catch(() => ({ Client: null }));
  if (!Client) {
    console.error('--check needs the "pg" package installed');
    process.exit(2);
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query('SELECT role_code, permission_code FROM identity.role_permissions');
    const diff = diffRolePermissions(rows.map((r) => ({ role: r.role_code, permission: r.permission_code })));
    if (diff.toAdd.length === 0 && diff.toRemove.length === 0) {
      console.log(`in sync: ${rolePermissionPairs().length} role/permission pairs`);
      process.exit(0);
    }
    console.error(`drift: +${diff.toAdd.length} to add, -${diff.toRemove.length} to remove`);
    for (const p of diff.toAdd) console.error(`  + ${p.role} ${p.permission}`);
    for (const p of diff.toRemove) console.error(`  - ${p.role} ${p.permission}`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

process.stdout.write(rolePermissionSyncSql() + '\n');
