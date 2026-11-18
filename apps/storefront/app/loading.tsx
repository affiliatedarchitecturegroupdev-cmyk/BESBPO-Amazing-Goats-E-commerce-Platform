// The loading skeleton (T-064) for the storefront's dynamic routes: catalogue,
// product, search and checkout all read the live gateway, so Next shows this
// while the server streams the real page. It mirrors the product grid so the
// layout does not jump when the content arrives.
export default function Loading() {
  return (
    <section aria-busy="true" aria-live="polite">
      <h1>Loading…</h1>
      <p className="p">Fetching the latest prices and stock.</p>
      <div className="grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <article key={i} className="card">
            <div className="img" aria-hidden="true" />
            <div className="row">
              <span className="fld" style={{ flex: 1, margin: '8px 0' }}>
                &nbsp;
              </span>
              <span className="fld" style={{ width: 64, margin: '8px 0' }}>
                &nbsp;
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
