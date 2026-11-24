// Wireframe: none — the FAQ was not in the wireframes (T-077).
import Link from 'next/link';
import { JsonLd } from '../../components/JsonLd';
import { FAQ_GROUPS, faqEntries } from '../../lib/faq';
import { faqJsonLd } from '../../lib/jsonld';
import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata({
  title: 'Frequently asked questions',
  description:
    'Delivery areas and cut-off times, payment and trade accounts, returns and refunds, halaal availability, and how to store your order.',
  path: '/faq',
});

/**
 * The FAQ (T-077).
 *
 * It is in the index because it answers the questions a shopper types into a
 * search engine before they trust a new food shop, and because `FAQPage` markup
 * is one of the few structured-data types that still earns a rich result.
 *
 * Every answer restates a policy commitment and links to it, so this page is a
 * signpost rather than a second, competing source of truth.
 */
export default function FaqPage() {
  const jsonLd = faqJsonLd(faqEntries());

  return (
    <section>
      {jsonLd && <JsonLd nodes={[jsonLd]} />}
      <h1>Frequently asked questions</h1>
      <p className="p">
        The short answers are here. The binding version of each one is in the policy it
        links to.
      </p>

      <nav aria-label="Question groups">
        <ul className="chips" style={{ marginBottom: 16 }}>
          {FAQ_GROUPS.map((g) => (
            <li key={g.id}>
              <a href={`#${g.id}`}>{g.title}</a>
            </li>
          ))}
        </ul>
      </nav>

      {FAQ_GROUPS.map((group) => (
        <section key={group.id} id={group.id} style={{ marginTop: 24 }}>
          <h2>{group.title}</h2>
          {group.entries.map((entry) => (
            <details key={entry.question} className="card" style={{ marginBottom: 8 }}>
              <summary>
                <strong>{entry.question}</strong>
              </summary>
              <p className="p">{entry.answer}</p>
              {entry.href && (
                <p>
                  <Link href={entry.href}>Read the full policy</Link>
                </p>
              )}
            </details>
          ))}
        </section>
      ))}
    </section>
  );
}
