// Wireframe: docs/wireframes/index.html#tp-statements
import { DEMO_STATEMENTS } from '../../lib/seed';

export default function StatementsPage() {
  return (
    <section>
      <p className="bar">Statements</p>

      <div className="row"><span>Balance</span><strong>R ---</strong></div>

      <table className="tbl">
        <thead>
          <tr><th>Invoice</th><th>Due</th><th>Status</th></tr>
        </thead>
        <tbody>
          {DEMO_STATEMENTS.map((row) => (
            <tr key={row.invoice}>
              <td>{row.invoice}</td>
              <td>{row.due}</td>
              <td>{row.status === 'Paid' ? <span className="tag">Paid</span> : <button className="btn" type="button">Pay</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <button className="btn" type="button">Open a dispute (photo and temperature)</button>
      <button className="btn" type="button">Download VAT invoices</button>
      <p className="p">Disputes are open for 24 hours after delivery, with photo and temperature evidence.</p>
    </section>
  );
}
