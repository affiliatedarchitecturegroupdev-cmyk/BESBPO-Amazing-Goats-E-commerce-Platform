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
export const metadata = { title: 'Sign in | Amazing Goats trade portal' };

export default function SignInPage({
  searchParams,
}: {
  searchParams: { returnTo?: string | string[]; error?: string };
}) {
  const returnTo = returnToFrom(searchParams.returnTo);
  const loginHref = `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <section className="card" style={{ maxWidth: 460, margin: '48px auto' }}>
      <h1>Trade sign in</h1>
      <p className="p">The trade portal is for approved business accounts: trade prices, standing orders and credit terms.</p>

      {searchParams.error && (
        <p className="p" role="alert" style={{ color: 'var(--kalahari)' }}>
          {searchParams.error === 'expired'
            ? 'Your session ended. Please sign in again.'
            : 'That sign-in did not complete. Please try again.'}
        </p>
      )}

      <p>
        <a className="btn" href={loginHref}>
          Sign in to your trade account
        </a>
      </p>

      <p className="p">Not approved yet? Apply for a trade account and we will review it.</p>

      <p className="p">
        <a href="/no-access">Who can use this portal?</a>
      </p>
    </section>
  );
}

export const dynamic = 'force-dynamic';
