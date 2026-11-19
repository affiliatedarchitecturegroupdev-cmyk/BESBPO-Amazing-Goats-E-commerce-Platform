import { returnToFrom } from '../../lib/auth-session';

/**
 * The sign-in screen (T-059).
 *
 * A screen rather than a bare redirect, so the person knows which portal they
 * are entering and can get back. The button points at this app's
 * `/api/auth/login` route, which forwards to the gateway server-side, so the
 * gateway's address never reaches the browser bundle.
 *
 * `returnTo` is re-validated here, so a crafted link cannot turn this screen into
 * an open redirect.
 */
export const metadata = { title: 'Sign in | Amazing Goats driver app' };

export default function SignInPage({
  searchParams,
}: {
  searchParams: { returnTo?: string | string[]; error?: string };
}) {
  const returnTo = returnToFrom(searchParams.returnTo);
  const loginHref = `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <section className="card" style={{ maxWidth: 460, margin: '48px auto' }}>
      <h1>Driver sign in</h1>
      <p className="p">The driver app is for Amazing Goats delivery drivers. Sign in to see your route and record deliveries.</p>

      {searchParams.error && (
        <p className="p" role="alert" style={{ color: 'var(--kalahari)' }}>
          {searchParams.error === 'expired'
            ? 'Your session ended. Please sign in again.'
            : 'That sign-in did not complete. Please try again.'}
        </p>
      )}

      <p>
        <a className="btn" href={loginHref}>
          Sign in to start your route
        </a>
      </p>

      <p className="p">The app works offline. Captures are stored on this device and sync when signal returns.</p>

      <p className="p">
        <a href="/no-access">Who can use this portal?</a>
      </p>
    </section>
  );
}

export const dynamic = 'force-dynamic';
