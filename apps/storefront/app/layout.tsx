import './globals.css';
import type { ReactNode } from 'react';
import { SiteHeader } from '../components/SiteHeader';

export const metadata = { title: 'Amazing Goats store | Amazing Goats (Ezimbuzini)' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-ZA">
      <body>
        <SiteHeader />
        <main className="container">{children}</main>
        <div className="strip" />
      </body>
    </html>
  );
}
