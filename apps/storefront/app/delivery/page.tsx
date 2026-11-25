// Wireframe: docs/wireframes/index.html#sf-delivery
import Link from 'next/link';
import { DeliveryAreaCheck } from '../../components/DeliveryAreaCheck';
import { CutoffBanner } from '../../components/CutoffBanner';
import { cutoffMessage, EARLY_WINDOW } from '../../lib/fulfilment';
import { isEmptyTable, routeDaySummary, zoneRows } from '../../lib/delivery';
import { loadZoneTable } from '../../lib/gateway';
import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata({
  title: 'Delivery',
  description: 'The weekly delivery cycle, the zones we serve across KwaZulu-Natal, and what delivery costs.',
  path: '/delivery',
});

// The zone table is live data, so render per request.
export const dynamic = 'force-dynamic';

export default async function DeliveryPage() {
  const { data: table, error } = await loadZoneTable();
  const rows = zoneRows(table);
  const summary = routeDaySummary(table.routeDays);

  return (
    <section>
      <h1>Delivery</h1>
      <p className="p">
        We deliver across KwaZulu-Natal on a weekly cycle. Check your area first, then order before the
        cut-off for the next route day.
      </p>

      <DeliveryAreaCheck />

      <CutoffBanner message={cutoffMessage('cycle')} />
      <p className="p">Early delivery for bakeries and caterers runs {EARLY_WINDOW}.</p>

      <h2>Zones and fees</h2>
      {error && <p className="p" role="alert">{error}</p>}
      {isEmptyTable(table) && !error && (
        <p className="p" role="status">
          No delivery zones are configured yet. Check your area above and we will tell you when yours
          is on a route.
        </p>
      )}

      {rows.length > 0 && (
        <table className="tbl">
          <caption>Delivery fees by zone. Fees include VAT.</caption>
          <thead>
            <tr><th scope="col">Zone</th><th scope="col">Where</th><th scope="col">Fee</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.code}>
                <th scope="row">{row.code}</th>
                <td>{row.name}</td>
                <td>
                  {row.fee}
                  {row.freeOver && <><br /><small>{row.freeOver}</small></>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Route days</h2>
      <p className="p">{summary}</p>

      <h2>Cold chain</h2>
      <p className="p">
        Chilled and frozen lines travel in a temperature-controlled vehicle, and every drop records the
        probe reading at the door so the cold chain is auditable.
      </p>

      <ul className="chips">
        <li><Link href="/boxes">Boxes</Link></li>
        <li><Link href="/produce">Dairy and produce</Link></li>
        <li><Link href="/recipes">Recipes and cuts</Link></li>
      </ul>

      <p><Link href="/">Back to home</Link></p>
    </section>
  );
}
