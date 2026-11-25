import Link from 'next/link';
import { currentSession } from '../../lib/auth-session';

/**
 * The "wrong portal" screen (T-059).
 *
 * Shown to a caller who *is* signed in but whose roles do not fit this portal.
 * Sending them back to sign-in instead would loop: they would sign in again,
 * receive the same roles, and be bounced to the same place. The screen therefore
 * names the problem and offers the way out — sign out, or go to the portal their
 * roles do fit.
 */
export const metadata = { title: 'No access | Amazing Goats admin' };

export default async function NoAccessPage() {
  const session = await currentSession();
  const roles = session?.user.roles ?? [];

  return (
    <section className="card" style={{ maxWidth: 520, margin: '48px auto' }}>
      <h1>No access to this portal</h1>
      <p className="p">
        You are signed in{session?.user.id ? ` as ${session.user.id}` : ''}, but this portal is
        for Amazing Goats staff and your account does not hold a staff role.
      </p>

      {roles.length > 0 && (
        <p className="p">
          Your roles: <strong>{roles.join(', ')}</strong>
        </p>
      )}

      <p className="p">
        If you run a business, the trade portal is where your account belongs. If you believe you
        should have access, ask an administrator to grant you a role.
      </p>

      <p>
        <Link className="btn" href="/">
          Back
        </Link>
        <form action="/api/auth/logout" method="post" style={{ display: 'inline' }}>
          <button className="btn btn-outline" type="submit">
            Sign out
          </button>
        </form>
      </p>
    </section>
  );
}

export const dynamic = 'force-dynamic';
