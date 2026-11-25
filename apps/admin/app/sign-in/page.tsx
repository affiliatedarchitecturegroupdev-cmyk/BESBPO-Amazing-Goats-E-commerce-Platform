import { returnToFrom } from '../../lib/auth-session';

/**
 * The sign-in screen (T-059).
 *
 * It is a screen rather than a bare redirect because a redirect to the identity
 * provider gives the person no idea which portal they are entering and no way
 * back. The button points at this app's `/api/auth/login` route, which forwards
 * to the gateway server-side, so the gateway's address never reaches the browser
 * bundle and the flow still works with JavaScript disabled.
 *
 * `returnTo` is carried in the query string and re-validated here, so a crafted
 * link cannot turn this screen into an open redirect.
 */
export const metadata = { title: 'Sign in | Amazing Goats admin' };

export default function SignInPage({
  searchParams,
}: {
  searchParams: { returnTo?: string | string[]; error?: string };
}) {
  const returnTo = returnToFrom(searchParams.returnTo);
  const loginHref = `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <section className="card" style={{ maxWidth: 460, margin: '48px auto' }}>
      <h1>Sign in</h1>
      <p className="p">
        The admin portal is for Amazing Goats staff. Sign in with your company account. Access is
        limited to approved office networks.
      </p>

      {searchParams.error && (
        <p className="p" role="alert" style={{ color: 'var(--kalahari)' }}>
          {searchParams.error === 'expired'
            ? 'Your session ended. Please sign in again.'
            : 'That sign-in did not complete. Please try again.'}
        </p>
      )}

      <p>
        <a className="btn" href={loginHref}>
          Continue with your company account
        </a>
      </p>

      <p className="p">
        You will be asked for a second factor if your account has one. Signing in here does not sign
        you in to the shop or the trade portal.
      </p>
    </section>
  );
}

export const dynamic = 'force-dynamic';
