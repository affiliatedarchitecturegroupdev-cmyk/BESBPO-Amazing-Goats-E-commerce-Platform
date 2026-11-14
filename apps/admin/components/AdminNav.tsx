import Link from 'next/link';
import { navFor } from '../lib/nav';
import type { Role } from '@ag/rbac';

export function AdminNav({ roles }: { roles: Role[] }) {
  const items = navFor(roles);
  return (
    <aside className="side">
      <Link className="brand" href="/">Amazing Goats</Link>
      <nav>
        <ul>
          {items.map((item) => (
            <li key={item.href}>
              <Link href={item.href}>{item.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
      <p className="p">{roles.join(', ')}</p>
    </aside>
  );
}
