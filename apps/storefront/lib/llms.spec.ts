import { describe, it, expect } from 'vitest';
import { buildLlmsTxt } from './llms';
import { CATEGORIES } from './catalog';
import { OCCASIONS } from './occasions';

const BASE = 'https://amazinggoats.store';

describe('buildLlmsTxt', () => {
  const txt = buildLlmsTxt(BASE);

  it('starts with the H1 title and a one-line summary the convention expects', () => {
    const lines = txt.split('\n');
    expect(lines[0]).toBe('# Amazing Goats');
    expect(lines[2].startsWith('> ')).toBe(true);
  });

  it('lists every category the shop renders, so the summary cannot drift', () => {
    for (const c of CATEGORIES) {
      expect(txt).toContain(`[${c.label}](${BASE}/shop/${c.slug})`);
    }
  });

  it('lists every occasion hub', () => {
    for (const o of OCCASIONS) {
      expect(txt).toContain(`[${o.label}](${BASE}/occasions/${o.slug})`);
    }
  });

  it('links the key pages and the sitemap', () => {
    for (const path of ['/delivery', '/produce', '/recipes', '/trade', '/about', '/contact']) {
      expect(txt).toContain(`(${BASE}${path})`);
    }
    expect(txt).toContain(`${BASE}/sitemap.xml`);
  });

  it('states the commercial facts an assistant would otherwise guess', () => {
    expect(txt).toContain('ZAR');
    expect(txt).toContain('excluding VAT');
    expect(txt).toContain('15% VAT');
    expect(txt).toContain('Sunday 17:00');
  });

  it('uses the environment host when one is given, and the default otherwise', () => {
    expect(buildLlmsTxt('https://shop.example.test/')).toContain('https://shop.example.test/shop/lamb');
    expect(buildLlmsTxt()).toContain('https://amazinggoats.store/shop/lamb');
  });

  it('does not leak private paths a crawler should not be pointed at', () => {
    for (const path of ['/account', '/cart', '/checkout', '/track/', '/api/']) {
      expect(txt).not.toContain(`](${BASE}${path})`);
    }
  });
});
