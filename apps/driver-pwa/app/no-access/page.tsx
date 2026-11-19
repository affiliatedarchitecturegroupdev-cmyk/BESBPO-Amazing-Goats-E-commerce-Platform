import Link from 'next/link';
import { currentSession } from '../../lib/auth-session';

/**
 * The "wrong portal" screen (T-059).
 *
 * Shown to a caller who *is* signed in but whose roles do not fit this portal.
 * Sending them back to sign-in would loop — they would sign in again, receive the
 * same roles, and return here. The screen names the problem and offers a way out.
 */
export const metadata = { title: 'No access | Amazing Goats driver app' };

export default async function NoAccessPage() {
  const session = await currentSession();
  const roles = session?.user.roles ?? [];

  return (
    <section className="card" style={{ maxWidth: 520, margin: '48px auto' }}>
      <h1>No access to this portal</h1>
      <p className="p">
        You are signed in{session?.user.id ? ` as ${session.user.id}` : ''}, but this portal is
        for driver app users and your account does not hold a matching role.
      </p>

      {roles.length > 0 && (
        <p className="p">
          Your roles: <strong>{roles.join(', ')}</strong>
        </p>
      )}

      <p className="p">
        If you believe you should have access, ask an administrator to grant you the role. Staff
        sign in at the admin portal; business accounts sign in at the trade portal.
      </p>

      <p>
        <Link className="btn" href="/">Back</Link>
        <form action="/api/auth/logout" method="post" style={{ display: 'inline' }}>
          <button className="btn btn-outline" type="submit">Sign out</button>
        </form>
      </p>
    </section>
  );
}

export const dynamic = 'force-dynamic';
