// Wireframe: docs/wireframes/index.html#pt-slots
import { bookedPct, slotsAvailable } from '../lib/portal-view';
import { loadSlots } from '../lib/gateway';
import { confirmSlotAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function HomePage({ searchParams }: { searchParams: { confirmed?: string; error?: string } }) {
  const { data: slots, error } = await loadSlots();

  return (
    <section>
      <h1>Slots</h1>
      <p className="p">Abattoir confirms slaughter slots, halaal flag.</p>

      {searchParams.confirmed && <p className="p">Slot confirmed.</p>}
      {searchParams.error && <p className="p" role="alert">Could not confirm the slot ({searchParams.error}).</p>}
      {error && <p className="p" role="alert">{error}</p>}

      {slots.length === 0 && !error && <p className="p">No slaughter slots yet.</p>}

      <table className="tbl">
        <thead>
          <tr><th>Date</th><th>Capacity</th><th>Booked</th><th>Available</th><th>Halaal</th><th>Status</th></tr>
        </thead>
        <tbody>
          {slots.map((slot) => (
            <tr key={slot.id}>
              <td>{slot.date}</td>
              <td>{slot.capacity}</td>
              <td>{bookedPct(slot)}%</td>
              <td>{slotsAvailable(slot)}</td>
              <td>{slot.halaal ? 'Yes' : 'No'}</td>
              <td><span className={slot.confirmed ? 'tag' : 'tag tag-watch'}>{slot.confirmed ? 'Confirmed' : 'Open'}</span></td>
            </tr>
          ))}
        </tbody>
      </table>

      {slots.some((s) => !s.confirmed) && (
        <form action={confirmSlotAction} className="row">
          <select name="id" aria-label="Slot to confirm">
            {slots.filter((s) => !s.confirmed).map((s) => (
              <option key={s.id} value={s.id}>{s.date}</option>
            ))}
          </select>
          <button className="btn" type="submit">Confirm slot</button>
        </form>
      )}
    </section>
  );
}
