import './globals.css';
import type { ReactNode } from 'react';
import { AdminNav } from '../components/AdminNav';
import { currentSession } from '../lib/auth-session';
import { currentRoles } from '../lib/session';

export const metadata = { title: 'Admin | Amazing Goats (Ezimbuzini)' };

/**
 * The admin shell (T-059). The guard is in `middleware.ts`, so this layout only
 * renders; it reads the verified session for the identity shown in the sidebar
 * and never grants access on its own.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await currentSession();
  const roles = session ? (session.user.roles as Parameters<typeof AdminNav>[0]['roles']) : await currentRoles();
  return (
    <html lang="en-ZA">
      <body>
        <div className="shell">
          <AdminNav roles={roles} identity={session?.user.id} />
          <main className="container">{children}</main>
        </div>
        <div className="strip" />
      </body>
    </html>
  );
}
