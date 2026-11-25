import { describe, it, expect } from 'vitest';
import {
  absoluteImage,
  buildSitemap,
  DEFAULT_OG_IMAGE,
  DEFAULT_SITE_URL,
  pageMetadata,
  PRIVATE_PATHS,
  publicRoutes,
  robotsRules,
  siteUrl,
  STATIC_ROUTES,
} from './seo';
import { CATEGORIES } from './catalog';
import { OCCASIONS } from './occasions';

describe('siteUrl', () => {
  it('falls back to the production host when unset or blank', () => {
    expect(siteUrl(undefined)).toBe(DEFAULT_SITE_URL);
    expect(siteUrl('   ')).toBe(DEFAULT_SITE_URL);
  });

  it('uses the environment host and trims a trailing slash', () => {
    expect(siteUrl('https://shop.example.test/')).toBe('https://shop.example.test');
  });
});

describe('publicRoutes', () => {
  it('lists the static pages, then a route per category and occasion', () => {
    const routes = publicRoutes();
    expect(routes.length).toBe(STATIC_ROUTES.length + CATEGORIES.length + OCCASIONS.length);
    expect(routes.map((r) => r.path)).toContain('/shop/lamb');
    expect(routes.map((r) => r.path)).toContain('/occasions/braai-day');
  });

  it('has no duplicate paths', () => {
    const paths = publicRoutes().map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe('buildSitemap', () => {
  it('makes every URL absolute against the canonical host', () => {
    const entries = buildSitemap('https://shop.example.test/');
    const urls = entries.map((e) => e.url);
    expect(urls).toContain('https://shop.example.test/');
    expect(urls).toContain('https://shop.example.test/shop/lamb');
    expect(urls.every((u) => u.startsWith('https://shop.example.test/'))).toBe(true);
  });

  it('carries the change frequency and priority through', () => {
    const home = buildSitemap('https://shop.example.test').find(
      (e) => e.url === 'https://shop.example.test/',
    );
    expect(home).toEqual({
      url: 'https://shop.example.test/',
      changeFrequency: 'daily',
      priority: 1,
    });
  });
});

describe('robotsRules', () => {
  it('allows the shop but keeps the private and transactional paths out', () => {
    const rules = robotsRules('https://shop.example.test');
    expect(rules.rules[0].allow).toBe('/');
    expect(rules.rules[0].disallow).toEqual(PRIVATE_PATHS);
    for (const p of ['/account', '/cart', '/checkout', '/track/', '/health', '/api/']) {
      expect(rules.rules[0].disallow).toContain(p);
    }
  });

  it('points crawlers at the sitemap on the canonical host', () => {
    expect(robotsRules('https://shop.example.test/').sitemap).toBe(
      'https://shop.example.test/sitemap.xml',
    );
  });
});

describe('pageMetadata', () => {
  it('sets a canonical URL, an Open Graph card and a Twitter card', () => {
    const m = pageMetadata({
      title: 'Boxes',
      description: 'Ready-made boxes.',
      path: '/boxes',
      baseUrl: 'https://shop.example.test',
    });
    expect(m.alternates?.canonical).toBe('https://shop.example.test/boxes');
    expect(m.openGraph?.title).toBe('Boxes | Amazing Goats');
    expect(m.openGraph?.url).toBe('https://shop.example.test/boxes');
    expect(m.openGraph?.locale).toBe('en_ZA');
    expect(m.twitter).toMatchObject({
      card: 'summary_large_image',
      title: 'Boxes | Amazing Goats',
    });
    expect(m.robots).toBeUndefined();
  });

  it('uses a trailing slash for the home page canonical', () => {
    const m = pageMetadata({
      title: 'Home',
      description: 'd',
      path: '/',
      baseUrl: 'https://shop.example.test',
    });
    expect(m.alternates?.canonical).toBe('https://shop.example.test/');
  });

  it('marks a page noindex when asked, and follows nothing', () => {
    const m = pageMetadata({
      title: 'Cart',
      description: 'd',
      path: '/cart',
      noindex: true,
      baseUrl: 'https://x.test',
    });
    expect(m.robots).toEqual({ index: false, follow: false });
  });
});

describe('absoluteImage', () => {
  const base = 'https://shop.example.test';

  it('falls back to the code-drawn card when a page has no image', () => {
    expect(absoluteImage(undefined, base)).toBe(`${base}${DEFAULT_OG_IMAGE}`);
    expect(absoluteImage('   ', base)).toBe(`${base}${DEFAULT_OG_IMAGE}`);
  });

  it('joins a relative path to the site URL, because crawlers do not resolve it', () => {
    expect(absoluteImage('/media/lamb.jpg', base)).toBe(`${base}/media/lamb.jpg`);
    expect(absoluteImage('media/lamb.jpg', base)).toBe(`${base}/media/lamb.jpg`);
  });

  it('leaves an absolute URL alone', () => {
    expect(absoluteImage('https://cdn.test/lamb.jpg', base)).toBe('https://cdn.test/lamb.jpg');
  });
});

describe('pageMetadata images', () => {
  it('puts an image on both the Open Graph and Twitter cards', () => {
    const m = pageMetadata({
      title: 'Lamb potjie',
      description: 'd',
      path: '/recipes/lamb-potjie',
      baseUrl: 'https://shop.example.test',
      imageUrl: '/media/potjie.jpg',
    });
    expect(m.openGraph?.images).toEqual([
      { url: 'https://shop.example.test/media/potjie.jpg', alt: 'Lamb potjie' },
    ]);
    expect(m.twitter).toMatchObject({ images: ['https://shop.example.test/media/potjie.jpg'] });
  });

  it('still emits an image when the page has none, so a shared link previews', () => {
    const m = pageMetadata({
      title: 'Boxes',
      description: 'd',
      path: '/boxes',
      baseUrl: 'https://shop.example.test',
    });
    expect(m.openGraph?.images).toEqual([
      { url: `https://shop.example.test${DEFAULT_OG_IMAGE}`, alt: 'Boxes' },
    ]);
  });
});
