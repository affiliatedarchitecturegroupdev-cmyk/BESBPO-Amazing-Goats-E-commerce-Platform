import Link from 'next/link';
import { navFor } from '../lib/nav';
import type { Role } from '@ag/rbac';

/**
 * The admin sidebar (T-059).
 *
 * The menu is generated from the caller's permissions, so a person only sees
 * what they may use (`docs/02-access-control.md`). The footer shows who is
 * signed in and offers a way out; sign-out is a POST to this app's logout route,
 * which clears the cookie here as well as at the gateway.
 */
export function AdminNav({ roles, identity }: { roles: Role[]; identity?: string }) {
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
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 10 }}>
        <p className="p" style={{ margin: '0 0 6px' }}>
          {identity ? <strong>{identity}</strong> : 'Signed in'}
        </p>
        <p className="p" style={{ margin: '0 0 8px' }}>{roles.join(', ') || 'no roles'}</p>
        <form action="/api/auth/logout" method="post">
          <button className="btn btn-outline" type="submit" style={{ marginLeft: 0 }}>
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
