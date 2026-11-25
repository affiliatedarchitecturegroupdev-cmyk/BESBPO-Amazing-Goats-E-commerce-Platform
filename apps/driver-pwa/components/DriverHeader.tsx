import { currentSession } from '../lib/auth-session';

/**
 * The driver app header (T-059).
 *
 * Kept deliberately small: a driver reads this on a phone, often in sunlight,
 * often offline. It shows who is signed in and a sign-out button, nothing more.
 * The identity comes from the gateway when it is reachable; offline, the page
 * still renders without a name rather than failing.
 */
export async function DriverHeader() {
  const session = await currentSession();
  return (
    <header style={{ background: 'var(--forest)', color: 'var(--cream)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <strong style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>Amazing Goats</strong>
      <span style={{ marginLeft: 'auto', fontSize: 14, opacity: 0.85 }}>
        {session?.user.id ?? 'Driver'}
      </span>
      <form action="/api/auth/logout" method="post">
        <button type="submit" style={{ background: 'transparent', color: 'var(--cream)', border: '1px solid var(--cream)', borderRadius: 8, padding: '4px 10px' }}>
          Sign out
        </button>
      </form>
    </header>
  );
}
