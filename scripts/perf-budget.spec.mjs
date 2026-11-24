// The storefront performance budget guard (T-080).
//
// The real measurement needs a browser and a running server, which CI does not
// have, and a timing test in CI would be flaky for reasons that have nothing to
// do with the code. So this guards the two things a machine can check honestly:
// the budget exists and is not vacuous, and the storefront keeps the structural
// properties the measurement depends on — an image without dimensions, or a
// skeleton that is the wrong shape, is what makes LCP and CLS regress.
//
// `scripts/web-vitals.mjs` produces the numbers; this fails the build when the
// conditions that produced them are removed.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, it, expect } from 'vitest';

const root = process.cwd();
const storefront = join(root, 'apps', 'storefront');
const budget = JSON.parse(readFileSync(join(root, 'scripts', 'perf-budget.json'), 'utf8')).budget;

/** Every `.tsx` file under the storefront, skipping build output. */
function sourceFiles(dir = storefront) {
  const found = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...sourceFiles(path));
    else if (name.endsWith('.tsx')) found.push(path);
  }
  return found;
}

describe('performance budget', () => {
  it('is declared with the thresholds the audit used', () => {
    expect(budget.lcpMs).toBeGreaterThan(0);
    expect(budget.cls).toBeGreaterThan(0);
    expect(budget.ttfbMs).toBeGreaterThan(0);
    expect(budget.transferredKb).toBeGreaterThan(0);
  });

  it('holds LCP and CLS at the "good" boundaries or better', () => {
    // Core Web Vitals calls 2.5 s and 0.1 the point where a page stops being
    // "good". A budget above either would pass a page Google already flags.
    expect(budget.lcpMs).toBeLessThanOrEqual(2500);
    expect(budget.cls).toBeLessThanOrEqual(0.1);
  });

  it('ships a measurement script alongside the budget', () => {
    expect(existsSync(join(root, 'scripts', 'web-vitals.mjs'))).toBe(true);
  });
});

/** Source with comments removed, so prose about `<img>` is not read as one. */
function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('structural causes of a poor LCP or CLS', () => {
  it('gives every <img> explicit width and height', () => {
    // An image without dimensions has no reserved box, so it shifts the page as
    // it decodes. This is the single most common CLS cause on a product grid.
    const offenders = [];
    for (const file of sourceFiles()) {
      const source = withoutComments(readFileSync(file, 'utf8'));
      for (const match of source.matchAll(/<img\b[^>]*>/gs)) {
        const tag = match[0];
        if (!/\bwidth=/.test(tag) || !/\bheight=/.test(tag)) {
          offenders.push(`${relative(root, file)}: ${tag.replace(/\s+/g, ' ').slice(0, 70)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('gives the product route its own skeleton, not the grid one', () => {
    // The shared skeleton is a six-card grid; the product page is one card. Using
    // the grid skeleton reserved 2135 px against a 489 px page and measured CLS
    // 0.111. The route needs a skeleton of its own shape.
    const productLoading = join(storefront, 'app', 'product', '[slug]', 'loading.tsx');
    expect(existsSync(productLoading)).toBe(true);
    const source = readFileSync(productLoading, 'utf8');
    const cardCount = (source.match(/className="card"/g) ?? []).length;
    expect(cardCount).toBe(1);
  });
});
