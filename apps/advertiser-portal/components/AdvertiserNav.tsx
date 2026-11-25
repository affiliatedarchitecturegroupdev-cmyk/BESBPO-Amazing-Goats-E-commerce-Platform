import Link from 'next/link';

const ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/campaigns/new', label: 'New campaign' },
  { href: '/wallet', label: 'Wallet' },
];

/**
 * The advertiser portal menu (T-059).
 *
 * Advertisers all hold `advertiser:own`, so one menu fits every caller. The
 * identity and sign-out sit at the end; sign-out is a POST so a link prefetcher
 * or a crawler cannot sign someone out.
 */
export function AdvertiserNav({ identity }: { identity?: string }) {
  return (
    <header className="bar">
      <Link className="brand" href="/">Amazing Goats Ads</Link>
      <nav className="nav">
        {ITEMS.map((item) => (
          <Link key={item.href} href={item.href}>{item.label}</Link>
        ))}
        {identity && <span className="nav-identity">{identity}</span>}
        <form action="/api/auth/logout" method="post" style={{ display: 'inline' }}>
          <button className="btn-outline" type="submit">Sign out</button>
        </form>
      </nav>
    </header>
  );
}
