import './globals.css';
import type { ReactNode } from 'react';
import { TradeNav } from '../components/TradeNav';
import { currentSession } from '../lib/auth-session';

export const metadata = { title: 'Trade portal | Amazing Goats (Ezimbuzini)' };

/**
 * The trade portal shell (T-059). The guard is in `middleware.ts`; this only
 * renders, and shows the verified identity in the menu.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await currentSession();
  return (
    <html lang="en-ZA">
      <body>
        <TradeNav identity={session?.user.id} />
        <main className="container">{children}</main>
        <div className="strip" />
      </body>
    </html>
  );
}
