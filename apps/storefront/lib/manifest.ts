import type { MetadataRoute } from 'next';
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from './seo';

/**
 * The web app manifest (T-064): makes the storefront installable and gives the
 * browser a name, colour and icons for the home screen. The icons point at the
 * generated `icon`/`apple-icon` routes, so there is no binary art to check in.
 */
export function webManifest(baseUrl: string = siteUrl()): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} store`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#F4ECD8',
    theme_color: '#1F3B2D',
    lang: 'en-ZA',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
