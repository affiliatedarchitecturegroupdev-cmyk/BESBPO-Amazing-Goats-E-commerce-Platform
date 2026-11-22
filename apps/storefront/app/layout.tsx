import './globals.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { SiteHeader } from '../components/SiteHeader';
import { JsonLd } from '../components/JsonLd';
import { SiteFooter } from '../components/SiteFooter';
import { ServiceWorkerRegistrar } from '../components/ServiceWorkerRegistrar';
import { contactFromEnv, organizationJsonLd } from '../lib/jsonld';
import { SITE_DESCRIPTION, SITE_LOCALE, SITE_NAME, siteUrl } from '../lib/seo';

// Site-wide metadata (T-064). `metadataBase` makes every relative canonical and
// Open Graph URL absolute; the icon, apple-icon and opengraph-image routes are
// picked up automatically, and the manifest makes the shop installable.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${SITE_NAME} store`, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: `${SITE_NAME} store`,
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: SITE_LOCALE,
    title: `${SITE_NAME} store`,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} store`,
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: '#1F3B2D',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-ZA">
      <body>
        {/* Sitewide Organization (T-073): one node, so every page identifies the
            business and its delivery area without repeating it per page. */}
        <JsonLd nodes={[organizationJsonLd(contactFromEnv())]} />
        <SiteHeader />
        <main className="container">{children}</main>
        <SiteFooter />
        <div className="strip" />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
