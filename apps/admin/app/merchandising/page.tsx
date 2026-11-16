// Wireframe: docs/wireframes/index.html#ad-merch
import { loadMerchandising } from '../../lib/gateway';

export const dynamic = 'force-dynamic';

export default async function MerchandisingPage() {
  const { data: sections, error } = await loadMerchandising();

  return (
    <section>
      <h1>Merchandising</h1>
      <p className="p">Curated sections by page, with a time window.</p>
      {error && <p className="p" role="alert">{error}</p>}

      {sections.length === 0 && !error && <p className="p">No merchandising sections yet.</p>}

      <table className="tbl">
        <thead>
          <tr><th>Code</th><th>Title</th><th>Page</th><th>Sort</th><th>Window</th><th>Active</th></tr>
        </thead>
        <tbody>
          {sections.map((s) => (
            <tr key={s.id}>
              <td>{s.code}</td>
              <td>{s.title}</td>
              <td>{s.page}</td>
              <td>{s.sort}</td>
              <td>{s.startsAt && s.endsAt ? `${s.startsAt} – ${s.endsAt}` : 'Always'}</td>
              <td><span className={s.active ? 'tag' : 'tag tag-watch'}>{s.active ? 'Active' : 'Hidden'}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
