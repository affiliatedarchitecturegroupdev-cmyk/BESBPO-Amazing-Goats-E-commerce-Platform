/**
 * The accessibility audit (T-080).
 *
 * Runs axe-core in real Chromium against every public storefront route and
 * prints the violations. axe is run at WCAG 2.2 A and AA, which is the standard
 * a South African public-facing service is held to, plus the best-practice rules
 * for landmarks and headings that WCAG leaves implicit.
 *
 * Usage: node scripts/a11y-audit.mjs [baseUrl]
 *
 * It is a report, not a gate: a rule that fires on a page needs a decision
 * (fix it, or record why it is acceptable), and a machine cannot make that
 * decision. `scripts/a11y-budget.spec.mjs` is the part that can be enforced.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer-core';

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const baseUrl = (process.argv[2] ?? 'http://localhost:4603').replace(/\/+$/, '');

/**
 * Every public route, plus the purchase path. Cart, checkout, account and track
 * render an empty or signed-out state without a session, which is what a
 * first-time visitor sees, so they are audited as they are rather than with a
 * faked session.
 */
const ROUTES = [
  '/',
  '/boxes',
  '/produce',
  '/recipes',
  '/recipes/potjie',
  '/shop/lamb',
  '/shop/chicken',
  '/shop/eggs',
  '/shop/dairy',
  '/shop/live-animals',
  '/product/AG-LM-002',
  '/occasions/sunday-lunch',
  '/search?q=lamb',
  '/delivery',
  '/faq',
  '/trade',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  '/returns',
  '/cookies',
  // The purchase path. The card names cart and checkout specifically, and they
  // are the pages where a keyboard trap or an unlabelled field costs a sale.
  '/cart',
  '/checkout',
  '/sign-in',
  '/track',
  '/track/AG-ORD-1001',
  '/account',
];

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const results = [];
let totalViolations = 0;

for (const route of ROUTES) {
  const page = await browser.newPage();
  // A phone viewport: most of this market browses on a handset, and a small
  // screen is where a contrast or target-size problem bites first.
  await page.setViewport({ width: 390, height: 844 });
  let status = 0;
  try {
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle2', timeout: 30000 });
    status = response?.status() ?? 0;
    await page.evaluate(axeSource);
    const result = await page.evaluate(async () =>
      // eslint-disable-next-line no-undef
      await axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
      }),
    );
    const violations = result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.length,
      sample: v.nodes[0]?.target?.join(' ') ?? '',
    }));
    totalViolations += violations.reduce((n, v) => n + v.nodes, 0);
    results.push({ route, status, violations });
  } catch (err) {
    results.push({ route, status, error: String(err).split('\n')[0], violations: [] });
  }
  await page.close();
}

await browser.close();

for (const r of results) {
  const count = r.violations.reduce((n, v) => n + v.nodes, 0);
  const mark = r.error || r.status >= 400 ? 'ERR' : count === 0 ? 'ok ' : `${count} `;
  console.log(`${mark} ${String(r.status).padEnd(4)} ${r.route}`);
  if (r.error) console.log(`      ${r.error}`);
  for (const v of r.violations) {
    console.log(`      [${v.impact}] ${v.id} x${v.nodes} — ${v.help}`);
    if (v.sample) console.log(`        at ${v.sample}`);
  }
}

const failing = results.filter((r) => r.violations.length > 0 || r.error || r.status >= 400);
console.log(`\n${results.length} routes, ${failing.length} with findings, ${totalViolations} violating nodes`);
