import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The ADR (docs/adr/0012-persistence-and-store-swap.md) requires one switch for
 * the whole service, so a deployment cannot end up with half its stores
 * persisted. A new module that news up an in-memory store directly would
 * silently do exactly that, and nothing else fails. This reads the source (the
 * infra/deploy.spec.mjs precedent) and fails if any module constructs an
 * in-memory store outside `selectStore`.
 */
function moduleFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return moduleFiles(path);
    return entry.endsWith('.module.ts') ? [path] : [];
  });
}

describe('commerce store driver', () => {
  it('pins every store to the driver, so none is left in memory', () => {
    const root = join(process.cwd(), 'src');
    const offenders = moduleFiles(root).filter((file) => {
      const text = readFileSync(file, 'utf8');
      return /new InMemory\w*Store\(/.test(text) && !text.includes('selectStore');
    });
    expect(offenders, `modules construct an in-memory store outside selectStore`).toEqual([]);
  });
});
