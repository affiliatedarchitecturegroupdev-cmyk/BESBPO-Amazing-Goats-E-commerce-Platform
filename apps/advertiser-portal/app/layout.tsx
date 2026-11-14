import './globals.css';
import type { ReactNode } from 'react';


export const metadata = { title: 'Advertiser portal | Amazing Goats (Ezimbuzini)' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-ZA">
      <body>

        <main className="container">{children}</main>
        <div className="strip" />
      </body>
    </html>
  );
}
