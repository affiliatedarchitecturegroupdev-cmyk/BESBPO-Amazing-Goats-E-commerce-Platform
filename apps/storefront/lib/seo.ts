import type { Metadata } from 'next';
import { CATEGORIES } from './catalog';
import { OCCASIONS } from './occasions';

/**
 * SEO for the storefront (T-064): one place for the canonical host, the public
 * route list and the per-page metadata shape. The route list is derived from the
 * same catalogue categories and occasion hubs the pages render, so the sitemap
 * cannot drift from the screens that exist.
 */

export const SITE_NAME = 'Amazing Goats';
export const SITE_LOCALE = 'en_ZA';
export const DEFAULT_SITE_URL = 'https://amazinggoats.store';
export const SITE_DESCRIPTION =
  'Farm-direct lamb, chicken, eggs and dairy from Ezimbuzini, delivered across KwaZulu-Natal on a weekly cycle.';

/** The canonical host, from the environment, with a trailing slash trimmed. */
export function siteUrl(env: string | undefined = process.env.NEXT_PUBLIC_STORE_URL): string {
  const value = env?.trim();
  return (value && value.length > 0 ? value : DEFAULT_SITE_URL).replace(/\/+$/, '');
}

export type ChangeFrequency =
  'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';

/** One indexable route: the path plus its sitemap hints. */
export interface RouteEntry {
  path: string;
  changeFrequency: ChangeFrequency;
  priority: number;
}

/** The routes that are not the catalogue: the pages that always exist. */
export const STATIC_ROUTES: RouteEntry[] = [
  { path: '/', changeFrequency: 'daily', priority: 1 },
  { path: '/boxes', changeFrequency: 'daily', priority: 0.8 },
  { path: '/produce', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/recipes', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/delivery', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/faq', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/trade', changeFrequency: 'monthly', priority: 0.6 },
];

/** Every public, indexable route: the static pages, then each category and occasion hub. */
export function publicRoutes(): RouteEntry[] {
  return [
    ...STATIC_ROUTES,
    ...CATEGORIES.map((c) => ({
      path: `/shop/${c.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...OCCASIONS.map((o) => ({
      path: `/occasions/${o.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ];
}

export interface SitemapEntry {
  url: string;
  changeFrequency: ChangeFrequency;
  priority: number;
}

/** Absolute sitemap entries for the public routes, given the canonical host. */
export function buildSitemap(
  baseUrl: string,
  routes: RouteEntry[] = publicRoutes(),
): SitemapEntry[] {
  const base = baseUrl.replace(/\/+$/, '');
  return routes.map((r) => ({
    url: r.path === '/' ? `${base}/` : `${base}${r.path}`,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}

/**
 * Paths that must not be indexed: the signed-in areas, the cart and checkout,
 * order tracking (it carries an order id) and the health probe.
 */
export const PRIVATE_PATHS = ['/account', '/cart', '/checkout', '/track/', '/health', '/api/'];

/** The robots rules: allow the shop, keep the private and transactional paths out. */
export function robotsRules(baseUrl: string) {
  const base = baseUrl.replace(/\/+$/, '');
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: [...PRIVATE_PATHS] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}

/**
 * Per-page metadata: a canonical URL, an Open Graph card and a Twitter card, so
 * a shared link previews with the page's own title and description. `noindex`
 * marks a page that must not appear in search results.
 */
/** The code-drawn social card, used when a page has no image of its own. */
export const DEFAULT_OG_IMAGE = '/opengraph-image';

/**
 * An absolute image URL for Open Graph.
 *
 * Crawlers do not resolve a relative `og:image`, so a path has to be joined to
 * the site URL. A page with no image falls back to the code-drawn card rather
 * than omitting the tag, because a shared link with no image previews as a bare
 * line of text.
 */
export function absoluteImage(imageUrl: string | undefined, base: string): string {
  const value = imageUrl?.trim();
  if (!value) return `${base}${DEFAULT_OG_IMAGE}`;
  if (/^https?:\/\//i.test(value)) return value;
  return `${base}${value.startsWith('/') ? value : `/${value}`}`;
}

export function pageMetadata(input: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
  baseUrl?: string;
  /** The page's own image. A relative path is resolved against the site URL. */
  imageUrl?: string;
}): Metadata {
  const base = siteUrl(input.baseUrl);
  const url = input.path === '/' ? `${base}/` : `${base}${input.path}`;
  const title = `${input.title} | ${SITE_NAME}`;
  const image = absoluteImage(input.imageUrl, base);
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: url },
    robots: input.noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      title,
      description: input.description,
      url,
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      type: 'website',
      images: [{ url: image, alt: input.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: input.description,
      images: [image],
    },
  };
}
