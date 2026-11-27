import Link from 'next/link';
import { requireSession } from '../../lib/auth-session';
import { loadMySubscriptions } from '../../lib/gateway';
import { pageMetadata } from '../../lib/seo';
import {
  cadenceLabel,
  nextRunLabel,
  sortForAccount,
  subscriptionState,
} from '../../lib/subscriptions';
import { setSubscriptionPaused } from './actions';

export const metadata = pageMetadata({
  title: 'Account',
  description: 'Your Amazing Goats account.',
  path: '/account',
  noindex: true,
});

// Reads the session cookie, so it must render per request.
export const dynamic = 'force-dynamic';

const NOTICES: Record<string, string> = {
  paused: 'Your recurring order is paused. It will not run until you resume it.',
  resumed: 'Your recurring order will run again on its next scheduled day.',
  signin: 'Please sign in again to change your recurring orders.',
  error: 'That change could not be made. Please try again.',
};

/**
 * The shopper's account (T-059, T-056).
 *
 * The guard is in `middleware.ts` and again here: middleware decides on an
 * unverified cookie, so the page asks the gateway — which verifies — before it
 * shows anything. A forged cookie that reaches this page renders the sign-in
 * redirect instead of an account.
 *
 * Orders are read on `/track`; this page links to them and shows the recurring
 * orders, which is the part that belongs to an account rather than to a parcel.
 */
export default async function AccountPage({
  searchParams,
}: {
  searchParams?: { subscription?: string };
}) {
  const session = await requireSession('/account');
  const roles = session.user.roles;
  const { data: subscriptions, error: subscriptionsError } = await loadMySubscriptions();
  const rows = sortForAccount(subscriptions);
  const notice = searchParams?.subscription ? NOTICES[searchParams.subscription] : undefined;

  return (
    <section>
      <h1>Your account</h1>
      <p className="p">
        Signed in as <strong>{session.user.id}</strong>
        {roles.length > 0 && <> · {roles.join(', ')}</>}
      </p>

      {notice && (
        <p className="p" role="status" style={{ marginTop: 12 }}>
          {notice}
        </p>
      )}

      <h2 style={{ marginTop: 24 }}>Recurring orders</h2>
      {subscriptionsError ? (
        <p className="p">{subscriptionsError}</p>
      ) : rows.length === 0 ? (
        <p className="p">
          You have no recurring orders yet. A recurring order delivers the same basket on the
          same day each cycle — <Link href="/shop">start from the shop</Link>.
        </p>
      ) : (
        <div className="grid" style={{ marginTop: 16 }}>
          {rows.map((subscription) => (
            <article className="card" key={subscription.id}>
              <h3>{cadenceLabel(subscription.cadence)}</h3>
              <p className="p">
                <strong>{subscriptionState(subscription)}</strong> · {nextRunLabel(subscription)}
              </p>
              {subscription.skipped.length > 0 && (
                <p className="p">
                  {subscription.skipped.length} run
                  {subscription.skipped.length === 1 ? '' : 's'} skipped
                </p>
              )}
              <form action={setSubscriptionPaused}>
                <input type="hidden" name="id" value={subscription.id} />
                <input type="hidden" name="paused" value={subscription.paused ? 'false' : 'true'} />
                <button className="btn btn-outline" type="submit">
                  {subscription.paused ? 'Resume' : 'Pause'}
                </button>
              </form>
            </article>
          ))}
        </div>
      )}

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
