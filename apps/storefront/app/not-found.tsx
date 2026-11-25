import Link from 'next/link';
import { CATEGORIES } from '../lib/catalog';

/**
 * The 404 screen (T-064, extended by T-077).
 *
 * A 404 is not an error message, it is a lost shopper. So it carries a real
 * search form — the same `/search?q=` the header uses — and the category links,
 * because the two things a person with a dead link wants are "find the thing" or
 * "get back into the shop". The form is a plain GET, so it works without
 * JavaScript.
 *
 * The copy avoids blaming the visitor: a sold-out item and an old link are the
 * two ordinary causes, and neither is their fault.
 */
export default function NotFound() {
  return (
    <section>
      <h1>We could not find that page</h1>
      <p className="p">
        The link may be old, or the item may have sold out. Nothing is broken on your side.
      </p>

      <form action="/search" method="get" role="search" style={{ margin: '16px 0' }}>
        <label htmlFor="not-found-q" className="p">
          Search the range
        </label>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <input
            id="not-found-q"
            name="q"
            type="search"
            placeholder="lamb neck, eggs, a braai box"
            style={{ flex: 1, padding: 8 }}
          />
          <button className="btn" type="submit">
            Search
          </button>
        </div>
      </form>

      <h2>Or browse a category</h2>
      <ul className="chips">
        {CATEGORIES.map((c) => (
          <li key={c.slug}>
            <Link href={`/shop/${c.slug}`} className="tag">
              {c.label}
            </Link>
          </li>
        ))}
      </ul>

      <p>
        <Link className="btn" href="/">
          Back to home
        </Link>
      </p>
    </section>
  );
}
