// The loading skeleton for a single product (T-080).
//
// The shared `app/loading.tsx` mirrors a six-card grid, but a product page is one
// card plus a handful of sections. Using the grid skeleton here reserved 2135 px
// and the real 489 px page then pulled the footer up by 1645 px, which measured
// CLS 0.111 on a mid-range handset. A skeleton only helps if it is the right
// shape; this one is.
export default function Loading() {
  return (
    <section aria-busy="true" aria-live="polite">
      <h1>Loading…</h1>
      <p className="p">Fetching the latest price and stock.</p>
      <article className="card">
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
    </section>
  );
}
