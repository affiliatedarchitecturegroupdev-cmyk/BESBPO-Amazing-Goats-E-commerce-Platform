import { returnToFrom } from '../../lib/auth-session';

/**
 * The second-factor step (T-059).
 *
 * The identity provider renders the factor itself: the gateway's `prompt=login`
 * redirect means the browser never returns here mid-flow with a partial session.
 * This screen exists for the case where the IdP reports that a factor is
 * required but the account has none enrolled — the person needs to be told what
 * to do rather than left on a blank page.
 *
 * The code is entered on the IdP's own screen, so this page never handles a
 * factor and never posts one. That keeps the factor out of our origin entirely.
 */
export const metadata = { title: 'Two-step verification | Amazing Goats admin' };

export default function MfaPage({
  searchParams,
}: {
  searchParams: { returnTo?: string | string[]; reason?: string };
}) {
  const returnTo = returnToFrom(searchParams.returnTo);
  const enrol = searchParams.reason === 'enrol';

  return (
    <section className="card" style={{ maxWidth: 480, margin: '48px auto' }}>
      <h1>Two-step verification</h1>

      {enrol ? (
        <>
          <p className="p">
            Your account needs a second factor before it can open this portal. Ask an administrator
            to enrol an authenticator app or a passkey for you; MFA is required for all staff
            accounts.
          </p>
          <p className="p">
            Once it is enrolled, sign in again and you will be asked for the code by your identity
            provider.
          </p>
        </>
      ) : (
        <p className="p">
          Your identity provider will ask for your second factor. Enter the code there, not here.
        </p>
      )}

      <p>
        <a className="btn" href={`/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`}>
          Try again
        </a>
      </p>
    </section>
  );
}

export const dynamic = 'force-dynamic';
