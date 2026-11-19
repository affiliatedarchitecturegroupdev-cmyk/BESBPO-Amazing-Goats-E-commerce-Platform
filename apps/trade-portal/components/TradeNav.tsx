import Link from 'next/link';

const ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/order', label: 'Quick order' },
  { href: '/standing-orders', label: 'Standing orders' },
  { href: '/statements', label: 'Statements' },
  { href: '/credit', label: 'Credit' },
  { href: '/team', label: 'Team' },
];

/**
 * The trade portal menu (T-059).
 *
 * Trade users all hold `trade:own`, so one menu fits. The identity and sign-out
 * sit at the end; sign-out is a POST so a prefetcher cannot trigger it.
 */
export function TradeNav({ identity }: { identity?: string }) {
  return (
    <header className="bar">
      <Link className="brand" href="/">Amazing Goats</Link>
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
