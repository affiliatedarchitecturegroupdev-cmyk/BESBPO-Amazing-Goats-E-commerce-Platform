import Link from 'next/link';
import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata({
  title: 'Trade',
  description:
    'Trade accounts for bakeries, caterers and retailers: weekly standing orders, credit terms and early windows.',
  path: '/trade',
});

// Wireframe: docs/wireframes/index.html#sf-trade-entry
/**
 * The trade entry point (T-059).
 *
 * This is the front door for a business, and it does one job: send the visitor to
 * the right place. Applying and signing in both live in the trade portal, which
 * is a separate app, so the links point at it rather than re-implementing the
 * form here. The address is an environment variable so a staging deploy points at
 * its own trade portal.
 */
const TRADE_PORTAL_URL = process.env.NEXT_PUBLIC_TRADE_PORTAL_URL ?? 'https://trade.amazinggoats.co.za';

export default function TradePage() {
  return (
    <section>
      <h1>Trade</h1>

      <article className="card">
        <h2>Run a business?</h2>
        <p className="p">
          Trade prices, standing orders and credit terms, with an early delivery window for bakeries
          and caterers.
        </p>
        <p>
          <a className="btn" href={`${TRADE_PORTAL_URL}/apply`}>Apply for a trade account</a>
          <a className="btn" href={`${TRADE_PORTAL_URL}/sign-in`} style={{ marginLeft: 8 }}>
            Sign in to the trade portal
          </a>
        </p>
      </article>

      <article className="card" style={{ marginTop: 12 }}>
        <h2>Bakeries and caterers</h2>
        <p className="p">
          Early delivery and the eggs programme: standing weekly orders with a locked cut-off, so
          your kitchen knows what is arriving and when.
        </p>
        <Link href="/produce">See dairy and produce</Link>
      </article>

      <p className="p">
        Applying asks for your registration number, a turnover declaration and a few documents,
        including a Certificate of Acceptability for food premises. A credit check needs your
        directors&rsquo; consent, which you give on the form.
      </p>
    </section>
  );
}
