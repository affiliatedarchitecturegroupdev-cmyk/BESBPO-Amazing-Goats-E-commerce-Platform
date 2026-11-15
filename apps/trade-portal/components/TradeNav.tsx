import Link from 'next/link';

const ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/order', label: 'Quick order' },
  { href: '/standing-orders', label: 'Standing orders' },
  { href: '/statements', label: 'Statements' },
  { href: '/credit', label: 'Credit' },
  { href: '/team', label: 'Team' },
];

/** The trade portal menu. Trade users all hold `trade:own`, so one menu fits. */
export function TradeNav() {
  return (
    <header className="bar">
      <Link className="brand" href="/">Amazing Goats</Link>
      <nav className="nav">
        {ITEMS.map((item) => (
          <Link key={item.href} href={item.href}>{item.label}</Link>
        ))}
      </nav>
    </header>
  );
}
