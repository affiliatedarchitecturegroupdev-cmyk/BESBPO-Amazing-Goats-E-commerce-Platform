import type { MetadataRoute } from 'next';
import { robotsRules, siteUrl } from '../lib/seo';

// robots.txt (T-064): allow the shop, keep the signed-in and transactional paths
// out of the index, and point crawlers at the sitemap.
export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return robotsRules(siteUrl());
}
