// Bootstrap contract for the monorepo (T-001).
//
// "pnpm install works" and "CI passes on an empty PR" are only trustworthy if
// the wiring they depend on is checked in. This test fails the build when a
// workspace stops exposing the scripts CI runs, when the lockfile drifts from
// the manifests, or when a config CI relies on is deleted. It reads files, and
// runs one read-only pnpm resolve; the real install and build run in the CI
// `node` job.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const root = process.cwd();
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const exists = (p) => existsSync(join(root, p));

function workspaceDirs() {
  const dirs = [];
  for (const parent of ['apps', 'services', 'packages']) {
    const base = join(root, parent);
    if (!existsSync(base)) continue;
    for (const name of readdirSync(base)) {
      // JS workspaces have a package.json; ai-forecast and analytics are Python.
      const dir = `${parent}/${name}`;
      if (existsSync(join(root, dir, 'package.json'))) dirs.push(dir);
    }
  }
  return dirs;
}

// pnpm may be installed directly or only reachable through corepack.
function pnpmCmd() {
  for (const cmd of [['pnpm'], ['corepack', 'pnpm']]) {
    try {
      execFileSync(cmd[0], [...cmd.slice(1), '--version'], { stdio: 'pipe', timeout: 60_000 });
      return cmd;
    } catch {
      /* try the next one */
    }
  }
  return null;
}

const workspaces = workspaceDirs();
const pnpm = pnpmCmd();

describe('monorepo bootstrap', () => {
  it('pnpm-workspace.yaml covers apps, services and packages', () => {
    const yaml = readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8');
    for (const glob of ['apps/*', 'services/*', 'packages/*']) {
      expect(yaml).toContain(glob);
    }
    expect(workspaces.length).toBeGreaterThan(0);
  });

  it('every workspace declares lint and test scripts', () => {
    for (const dir of workspaces) {
      const pkg = read(`${dir}/package.json`);
      expect(pkg.scripts?.lint, `${dir} lint`).toBeTruthy();
      expect(pkg.scripts?.test, `${dir} test`).toBeTruthy();
    }
  });

  it('test scripts tolerate a package with no tests yet', () => {
    // A workspace whose test script is bare `vitest run` exits 1 when it has no
    // spec files, which breaks `pnpm -r test` on a fresh checkout. Either pass
    // --passWithNoTests or ship at least one spec.
    for (const dir of workspaces) {
      const script = read(`${dir}/package.json`).scripts.test;
      if (script.includes('--passWithNoTests')) continue;
      const specs = readdirSync(join(root, dir), { recursive: true }).filter((f) =>
        /\.spec\.[cm]?[jt]sx?$/.test(String(f)),
      );
      expect(specs.length, `${dir} runs bare vitest but has no spec files`).toBeGreaterThan(0);
    }
  });

  it('the lockfile is in step with the manifests', () => {
    // Catches a manifest edited without running pnpm install: `--frozen-lockfile`
    // in CI would then fail. --lockfile-only still resolves the full graph.
    expect(pnpm, 'pnpm is not on PATH (install it, or enable corepack)').not.toBeNull();
    expect(() =>
      execFileSync(pnpm[0], [...pnpm.slice(1), 'install', '--frozen-lockfile', '--lockfile-only'], {
        cwd: root,
        stdio: 'pipe',
        timeout: 120_000,
      }),
    ).not.toThrow();
  });

  it('files CI relies on are present', () => {
    for (const f of [
      '.github/workflows/ci.yml',
      '.github/workflows/agent-gate.yml',
      'pnpm-lock.yaml',
      '.nvmrc',
      '.gitignore',
      'tsconfig.base.json',
    ]) {
      expect(exists(f), `${f} is missing`).toBe(true);
    }
  });
});
