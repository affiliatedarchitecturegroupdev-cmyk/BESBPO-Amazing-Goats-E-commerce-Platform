// The loading skeleton (T-064) for the advertiser portal's dynamic routes, so a slow
// read streams a shaped page instead of a blank one.
export default function Loading() {
  return (
    <section aria-busy="true" aria-live="polite">
      <h1>Loading…</h1>
      <p className="p">Fetching the latest data.</p>
      <div className="card">
        <div className="fld" style={{ margin: '8px 0' }}>
          &nbsp;
        </div>
        <div className="fld" style={{ margin: '8px 0' }}>
          &nbsp;
        </div>
        <div className="fld" style={{ margin: '8px 0' }}>
          &nbsp;
        </div>
      </div>
    </section>
  );
}
