// Wireframe: docs/wireframes/index.html#ad-pricing
import { loadPriceLists } from '../../lib/gateway';

export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  const { data: lists, error } = await loadPriceLists();

  return (
    <section>
      <h1>Pricing</h1>
      <p className="p">Price lists, audiences and four-eyes approval.</p>
      {error && <p className="p" role="alert">{error}</p>}

      {lists.length === 0 && !error && <p className="p">No price lists yet.</p>}

      <table className="tbl">
        <thead>
          <tr><th>Code</th><th>Name</th><th>Audience</th><th>Valid from</th><th>Items</th><th>Status</th></tr>
        </thead>
        <tbody>
          {lists.map((list) => (
            <tr key={list.id}>
              <td>{list.code}</td>
              <td>{list.name}</td>
              <td>{list.audience}</td>
              <td>{list.validFrom}</td>
              <td>{list.items.length}</td>
              <td>
                <span className={list.status === 'published' ? 'tag' : 'tag tag-watch'}>{list.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="p">A price change is published by a second person (four-eyes).</p>
    </section>
  );
}
