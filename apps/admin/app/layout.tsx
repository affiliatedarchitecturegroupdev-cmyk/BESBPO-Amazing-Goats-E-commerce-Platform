import './globals.css';
import type { ReactNode } from 'react';
import { AdminNav } from '../components/AdminNav';
import { currentRoles } from '../lib/session';

export const metadata = { title: 'Admin | Amazing Goats (Ezimbuzini)' };

export default function RootLayout({ children }: { children: ReactNode }) {
  const roles = currentRoles();
  return (
    <html lang="en-ZA">
      <body>
        <div className="shell">
          <AdminNav roles={roles} />
          <main className="container">{children}</main>
        </div>
        <div className="strip" />
      </body>
    </html>
  );
}
