import type { MetadataRoute } from 'next';
import { buildSitemap, siteUrl } from '../lib/seo';

// The sitemap (T-064): the public routes, derived from the same categories and
// occasion hubs the pages render, so it cannot list a screen that does not exist.
export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemap(siteUrl()).map((entry) => ({
    url: entry.url,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));
}
