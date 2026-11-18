import type { MetadataRoute } from 'next';
import { webManifest } from '../lib/manifest';
import { siteUrl } from '../lib/seo';

// The web app manifest (T-064), served at /manifest.webmanifest. It makes the
// storefront installable; the icons resolve to the generated `icon` route.
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return webManifest(siteUrl());
}
