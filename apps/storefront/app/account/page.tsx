import Link from 'next/link';
import { requireSession } from '../../lib/auth-session';
import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata({
  title: 'Account',
  description: 'Your Amazing Goats account.',
  path: '/account',
  noindex: true,
});

// Reads the session cookie, so it must render per request.
export const dynamic = 'force-dynamic';

/**
 * The shopper's account (T-059).
 *
 * The guard is in `middleware.ts` and again here: middleware decides on an
 * unverified cookie, so the page asks the gateway — which verifies — before it
 * shows anything. A forged cookie that reaches this page renders the sign-in
 * redirect instead of an account.
 *
 * Orders and addresses are T-0xx work; this screen shows the signed-in identity
 * and the way to the things that exist today.
 */
export default async function AccountPage() {
  const session = await requireSession('/account');
  const roles = session.user.roles;

  return (
    <section>
      <h1>Your account</h1>
      <p className="p">
        Signed in as <strong>{session.user.id}</strong>
        {roles.length > 0 && <> · {roles.join(', ')}</>}
      </p>

      <div className="grid" style={{ marginTop: 16 }}>
        <article className="card">
          <h2>Orders</h2>
          <p className="p">See what you ordered and where it is.</p>
          <Link className="btn" href="/track">Your orders</Link>
        </article>
        <article className="card">
          <h2>Delivery details</h2>
          <p className="p">We use your delivery address and zone to work out the slot and fee.</p>
          <Link href="/delivery">Delivery zones and slots</Link>
        </article>
        <article className="card">
          <h2>Privacy</h2>
          <p className="p">See what we hold, why, and how to ask for a copy or a deletion.</p>
          <Link href="/legal/privacy">Privacy and POPIA</Link>
        </article>
      </div>

      <form action="/api/auth/logout" method="post" style={{ marginTop: 20 }}>
        <button className="btn btn-outline" type="submit">Sign out</button>
      </form>
    </section>
  );
}
