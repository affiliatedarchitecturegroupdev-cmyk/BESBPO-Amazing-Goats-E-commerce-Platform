'use client';
import { useEffect } from 'react';

// The route error boundary (T-064): an unhandled error in a page shows this
// instead of the raw Next.js default. It offers a retry and a way home, and it
// never prints the error message to the shopper (it may name internal detail).
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the digest in the browser console so a report can be tied to a log
    // line, without showing it to the shopper.
    console.error('storefront route error', error.digest ?? error.message);
  }, [error]);

  return (
    <section>
      <h1>Something went wrong</h1>
      <p className="p">We could not load this page. It is usually temporary — please try again.</p>
      <button className="btn" type="button" onClick={() => reset()}>
        Try again
      </button>{' '}
      <a className="btn o" href="/">
        Back to home
      </a>
    </section>
  );
}
