import './globals.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { ServiceWorkerRegistrar } from '../components/ServiceWorkerRegistrar';
import { DriverHeader } from '../components/DriverHeader';

// The driver app is the PWA (T-064): a manifest, a theme colour and a service
// worker so it opens and keeps working offline, which is the whole point.
export const metadata: Metadata = {
  title: 'Driver app (offline first) | Amazing Goats (Ezimbuzini)',
  description: 'Day pack, proof of delivery and sync for Amazing Goats drivers.',
  applicationName: 'Amazing Goats Driver',
  manifest: '/manifest.json',
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
        <DriverHeader />
        <main className="container">{children}</main>
        <div className="strip" />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
