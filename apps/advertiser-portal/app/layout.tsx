import './globals.css';
import type { ReactNode } from 'react';
import { AdvertiserNav } from '../components/AdvertiserNav';
import { currentSession } from '../lib/auth-session';

export const metadata = { title: 'Advertiser portal | Amazing Goats (Ezimbuzini)' };

/**
 * The advertiser portal shell (T-059). The guard is in `middleware.ts`; this only
 * renders, and shows the verified identity in the menu.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await currentSession();
  return (
    <html lang="en-ZA">
      <body>
        <AdvertiserNav identity={session?.user.id} />
        <main className="container">{children}</main>
        <div className="strip" />
      </body>
    </html>
  );
}
