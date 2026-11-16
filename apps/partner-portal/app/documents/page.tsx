// Wireframe: docs/wireframes/index.html#pt-docs
import { documentLabel, documentState } from '../../lib/portal-view';
import { loadDocuments } from '../../lib/gateway';

export const dynamic = 'force-dynamic';

export default async function DocumentsPage() {
  const { data: docs, error } = await loadDocuments();
  const now = new Date();

  return (
    <section>
      <h1>Documents</h1>
      <p className="p">Certificates with expiry alerts.</p>
      {error && <p className="p" role="alert">{error}</p>}

      {docs.length === 0 && !error && <p className="p">No documents on file.</p>}

      <table className="tbl">
        <thead>
          <tr><th>Document</th><th>Expires</th><th>Status</th></tr>
        </thead>
        <tbody>
          {docs.map((doc) => {
            const state = documentState(doc.expiresOn, now);
            return (
              <tr key={doc.id}>
                <td>{doc.name}</td>
                <td>{doc.expiresOn}</td>
                <td>
                  <span className={state === 'valid' ? 'tag' : 'tag tag-watch'}>{documentLabel(state)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <button className="btn" type="button">Upload</button>
    </section>
  );
}
