import { returnToFrom } from '../../lib/auth-session';

/**
 * The second-factor step (T-059).
 *
 * The identity provider renders the factor itself, so this page never handles a
 * code. It exists for the case where a factor is required but none is enrolled,
 * so the person is told what to do instead of meeting a blank page.
 */
export const metadata = { title: 'Two-step verification | Amazing Goats trade portal' };

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
        <p className="p">
          Your account needs a second factor before it can open this portal. Ask an administrator to
          enrol an authenticator app or a passkey for you, then sign in again.
        </p>
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
