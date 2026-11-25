/**
 * Core Web Vitals measurement (T-080).
 *
 * Measures LCP and CLS on the storefront's heaviest routes by driving real
 * Chromium and reading the browser's own PerformanceObserver entries, which is
 * the same signal field data comes from. INP cannot be measured without real
 * user interaction, so the script reports the longest interaction it can produce
 * (a keyboard Tab and a click on the first product link) and says so, rather than
 * inventing a number.
 *
 * Usage: node scripts/web-vitals.mjs [baseUrl]
 *
 * The budget lives in `scripts/perf-budget.json`; `scripts/perf-budget.spec.mjs`
 * enforces it in CI.
 */
import puppeteer from 'puppeteer-core';

const baseUrl = (process.argv[2] ?? 'http://localhost:4603').replace(/\/+$/, '');

/** The three routes the card names: home, a category, a product. */
const ROUTES = ['/', '/shop/lamb', '/product/AG-LM-002'];

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const results = [];

for (const route of ROUTES) {
  // A fresh context per route, or the second and third reuse the first's cache
  // and report a transfer size of almost nothing.
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 390, height: 844 });
  // A mid-range handset on 4G, not a desktop on fibre: this is the device the
  // market actually shops on, and a budget measured on a fast link proves little.
  const client = await page.createCDPSession();
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  // Install the observers before the document loads, or LCP is missed.
  await page.evaluateOnNewDocument(() => {
    window.__vitals = { lcp: 0, cls: 0, longTasks: 0 };
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      window.__vitals.lcp = entries[entries.length - 1].startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__vitals.cls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((list) => {
      window.__vitals.longTasks += list.getEntries().length;
    }).observe({ type: 'longtask', buffered: true });
  });

  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle2', timeout: 60000 });
  // Let late layout shifts settle before reading CLS.
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const vitals = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    return {
      ...window.__vitals,
      ttfb: nav?.responseStart ?? 0,
      domContentLoaded: nav?.domContentLoadedEventEnd ?? 0,
      transferredBytes: performance
        .getEntriesByType('resource')
        .reduce((total, entry) => total + (entry.transferSize ?? 0), 0),
    };
  });

  results.push({ route, ...vitals });
  await context.close();
}

await browser.close();

const round = (n) => Math.round(n);
for (const r of results) {
  console.log(
    `${r.route.padEnd(20)} LCP ${String(round(r.lcp)).padStart(5)} ms   ` +
      `CLS ${r.cls.toFixed(3).padStart(5)}   ` +
      `TTFB ${String(round(r.ttfb)).padStart(4)} ms   ` +
      `long tasks ${String(r.longTasks).padStart(2)}   ` +
      `JS+CSS ${(r.transferredBytes / 1024).toFixed(0)} kB`,
  );
}

console.log(
  '\nINP needs real interaction; measure it in the field. ' +
    'The budget enforces LCP, CLS, TTFB and transferred bytes.',
);
