import Link from 'next/link';

const ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/campaigns/new', label: 'New campaign' },
  { href: '/wallet', label: 'Wallet' },
];

/** The advertiser portal menu. Advertisers all hold `advertiser:own`. */
export function AdvertiserNav() {
  return (
    <header className="bar">
      <Link className="brand" href="/">Amazing Goats Ads</Link>
      <nav className="nav">
        {ITEMS.map((item) => (
          <Link key={item.href} href={item.href}>{item.label}</Link>
        ))}
      </nav>
    </header>
  );
}
