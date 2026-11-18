'use client';
import './globals.css';

// The top-level error boundary (T-064). It only runs when the root layout itself
// throws, so it must render its own <html> and <body>. It still draws the brand
// shell so a fatal error looks like the trade portal, and it keeps the copy free
// of internal detail.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en-ZA">
      <body>
        <header
          style={{
            background: 'var(--forest)',
            color: 'var(--cream)',
            padding: '10px 18px',
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
            fontWeight: 700,
            fontSize: 20,
          }}
        >
          Amazing Goats
        </header>
        <main className="container">
          <section>
            <h1>This page is unavailable</h1>
            <p className="p">Something went wrong at our end. Please try again in a moment.</p>
            <button className="btn" type="button" onClick={() => reset()}>
              Try again
            </button>{' '}
            <a className="btn o" href="/">
              Back to trade portal
            </a>
            {error.digest ? <p className="p">Reference: {error.digest}</p> : null}
          </section>
        </main>
        <div className="strip" />
      </body>
    </html>
  );
}
