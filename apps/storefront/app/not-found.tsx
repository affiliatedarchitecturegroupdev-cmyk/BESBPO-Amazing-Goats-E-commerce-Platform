import Link from 'next/link';

// The 404 screen (T-064): shown for a bad URL or a `notFound()` from a page.
// Plain-language copy, a route back to the shop, and no personal data.
export default function NotFound() {
  return (
    <section>
      <h1>We could not find that page</h1>
      <p className="p">
        The link may be old, or the item may have sold out. Nothing is broken on your side.
      </p>
      <ul className="chips">
        <li>
          <Link href="/">Home</Link>
        </li>
        <li>
          <Link href="/shop/lamb">Shop the range</Link>
        </li>
        <li>
          <Link href="/search">Search</Link>
        </li>
        <li>
          <Link href="/cart">Cart</Link>
        </li>
      </ul>
      <p>
        <Link className="btn" href="/">
          Back to home
        </Link>
      </p>
    </section>
  );
}
