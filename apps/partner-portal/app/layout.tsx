import './globals.css';
import type { ReactNode } from 'react';
import Link from 'next/link';

export const metadata = { title: 'Partner portal | Amazing Goats (Ezimbuzini)' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-ZA">
      <body>
        <div className="container">
          <nav className="bar">
            <b>Amazing Goats · Partners</b>
            <span className="links">
              <Link href="/">Slots</Link>
              <Link href="/orders">Orders</Link>
              <Link href="/documents">Documents</Link>
            </span>
          </nav>
          <main>{children}</main>
        </div>
        <div className="strip" />
      </body>
    </html>
  );
}
