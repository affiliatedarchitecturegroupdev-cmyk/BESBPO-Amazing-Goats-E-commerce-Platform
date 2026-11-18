// App shell contract (T-064).
//
// Every front end must handle the three states Next.js gives it for free but
// leaves blank by default: a not-found page, a route error boundary, a loading
// state, and a top-level error boundary. This test fails the build when an app
// stops shipping one, so a new app cannot be added without the shell. It reads
// files only.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const root = process.cwd();

function nextApps() {
  const base = join(root, 'apps');
  return readdirSync(base).filter((name) => existsSync(join(base, name, 'app', 'layout.tsx')));
}

const SHELL_FILES = ['not-found.tsx', 'error.tsx', 'loading.tsx', 'global-error.tsx'];

describe('front-end app shell', () => {
  it('finds the front-end apps', () => {
    expect(nextApps().length).toBeGreaterThanOrEqual(6);
  });

  it('every app ships a not-found, error, loading and global-error screen', () => {
    for (const name of nextApps()) {
      for (const file of SHELL_FILES) {
        expect(
          existsSync(join(root, 'apps', name, 'app', file)),
          `${name}/app/${file} is missing`,
        ).toBe(true);
      }
    }
  });

  it('the error boundaries are client components that offer a retry', () => {
    for (const name of nextApps()) {
      for (const file of ['error.tsx', 'global-error.tsx']) {
        const src = readFileSync(join(root, 'apps', name, 'app', file), 'utf8');
        expect(src, `${name}/${file} must be a client component`).toMatch(/^['"]use client['"]/m);
        expect(src, `${name}/${file} must call reset()`).toMatch(/reset\(\)/);
      }
    }
  });

  it('the global error renders its own html and body', () => {
    for (const name of nextApps()) {
      const src = readFileSync(join(root, 'apps', name, 'app', 'global-error.tsx'), 'utf8');
      expect(src, `${name}/global-error.tsx must render <html>`).toMatch(/<html/);
      expect(src, `${name}/global-error.tsx must render <body>`).toMatch(/<body/);
    }
  });
});

const STOREFRONT_SEO = [
  'app/sitemap.ts',
  'app/robots.ts',
  'app/manifest.ts',
  'app/icon.tsx',
  'app/apple-icon.tsx',
  'app/opengraph-image.tsx',
  'app/twitter-image.tsx',
  'public/sw.js',
  'lib/seo.ts',
  'lib/manifest.ts',
];

describe('storefront SEO and PWA basics', () => {
  it('ships the sitemap, robots, manifest, icons, social cards and a service worker', () => {
    for (const file of STOREFRONT_SEO) {
      expect(
        existsSync(join(root, 'apps', 'storefront', file)),
        `storefront/${file} is missing`,
      ).toBe(true);
    }
  });

  it('the storefront layout declares the manifest and a theme colour', () => {
    const src = readFileSync(join(root, 'apps', 'storefront', 'app', 'layout.tsx'), 'utf8');
    expect(src).toMatch(/manifest:\s*['"]\/manifest\.webmanifest['"]/);
    expect(src).toMatch(/themeColor/);
    expect(src).toMatch(/metadataBase/);
  });

  it('the driver PWA declares its manifest', () => {
    const src = readFileSync(join(root, 'apps', 'driver-pwa', 'app', 'layout.tsx'), 'utf8');
    expect(src).toMatch(/manifest:\s*['"]\/manifest\.json['"]/);
  });
});
