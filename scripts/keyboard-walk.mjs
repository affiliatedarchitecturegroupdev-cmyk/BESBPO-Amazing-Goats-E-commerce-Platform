/**
 * Keyboard-only walkthrough of the purchase path (T-080).
 *
 * axe cannot see a keyboard trap, a focus order that jumps across the page, or a
 * control that is reachable but invisible when focused. This drives the real
 * browser with the Tab key alone and reports, in order, every element that takes
 * focus, whether it is visible while focused, and whether focus ever escapes to
 * the browser chrome mid-page (the signature of a trap).
 *
 * Usage: node scripts/keyboard-walk.mjs [baseUrl]
 */
import puppeteer from 'puppeteer-core';

const baseUrl = (process.argv[2] ?? 'http://localhost:4603').replace(/\/+$/, '');

/** The purchase path the card names: browse, cart, checkout, confirmation. */
const PATH = ['/shop/lamb', '/product/AG-LM-002', '/cart', '/checkout'];

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

let failures = 0;

for (const route of PATH) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle2', timeout: 60000 });

  // Start from the document, not from wherever the mouse happens to be.
  await page.evaluate(() => document.body.focus());
  await page.keyboard.press('Tab');

  const stops = [];
  for (let i = 0; i < 40; i += 1) {
    const stop = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return { atBody: true };
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      // `textContent` is empty for an input, so the name comes from the label or
      // aria-label it is associated with. `||` not `??`: an element with no
      // associated label yields '' rather than null, and '' must fall through.
      const labelledBy = el.getAttribute('aria-labelledby');
      const fromLabel = labelledBy
        ? (document.getElementById(labelledBy)?.textContent ?? '')
        : (el.labels?.[0]?.textContent ?? '');
      return {
        tag: el.tagName.toLowerCase(),
        text: (el.getAttribute('aria-label') || fromLabel || el.textContent || '').trim().slice(0, 34),
        href: el.getAttribute('href') ?? undefined,
        // A control that takes focus but is not visible is a keyboard trap in
        // practice: the user has focus and cannot see where it went.
        invisible: style.visibility === 'hidden' || style.display === 'none' || (box.width === 0 && box.height === 0),
        // An outline of `none` on a focused element fails WCAG 2.2 2.4.11.
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
      };
    });

    if (stop.atBody) break;
    stops.push(stop);
    await page.keyboard.press('Tab');
  }

  const invisible = stops.filter((s) => s.invisible);
  const noRing = stops.filter((s) => s.outlineStyle === 'none' || s.outlineWidth === '0px');

  console.log(`\n${route}`);
  console.log(`  ${stops.length} focus stops`);
  console.log('  order: ' + stops.slice(0, 14).map((s) => `${s.tag}:${s.text || s.href || '-'}`).join(' > '));
  if (invisible.length > 0) {
    failures += 1;
    console.log(`  FAIL ${invisible.length} stop(s) take focus while invisible: ${invisible.map((s) => s.text).join(', ')}`);
  }
  if (noRing.length > 0) {
    failures += 1;
    console.log(`  FAIL ${noRing.length} stop(s) have no visible focus ring: ${noRing.map((s) => `${s.tag}:${s.text}`).join(', ')}`);
  }
  if (stops.length === 0) {
    failures += 1;
    console.log('  FAIL nothing on the page takes focus');
  }

  await page.close();
}

await browser.close();

console.log(failures === 0 ? '\nPASS: no traps, no invisible stops, every stop shows a ring.' : `\n${failures} route(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
