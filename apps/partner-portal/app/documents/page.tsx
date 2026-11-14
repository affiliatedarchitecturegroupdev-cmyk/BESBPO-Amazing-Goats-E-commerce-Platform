// Wireframe: docs/wireframes/index.html#pt-docs
import { DEMO_DOCS, documentLabel, documentState } from '../../lib/portal-view';

export default function DocumentsPage() {
  const now = new Date();
  return (
    <section>
      <h1>Documents</h1>
      <p className="p">Certificates with expiry alerts.</p>

      <table className="tbl">
        <thead>
          <tr><th>Document</th><th>Expires</th><th>Status</th></tr>
        </thead>
        <tbody>
          {DEMO_DOCS.map((doc) => {
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
