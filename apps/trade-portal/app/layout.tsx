import './globals.css';
import type { ReactNode } from 'react';
import { TradeNav } from '../components/TradeNav';

export const metadata = { title: 'Trade portal | Amazing Goats (Ezimbuzini)' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-ZA">
      <body>
        <TradeNav />
        <main className="container">{children}</main>
        <div className="strip" />
      </body>
    </html>
  );
}
