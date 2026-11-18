import Link from 'next/link';

// The 404 screen (T-064): shown for a bad URL or a `notFound()` from a page.
// Plain-language copy and a route back into the driver app.
export default function NotFound() {
  return (
    <section>
      <h1>We could not find that page</h1>
      <p className="p">The link may be old, or you may not have access to it.</p>
      <p>
        <Link className="btn" href="/">
          Back to driver app
        </Link>
      </p>
    </section>
  );
}
