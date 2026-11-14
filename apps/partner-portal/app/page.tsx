// Wireframe: docs/wireframes/index.html#pt-slots
import { DEMO_SLOTS, bookedPct, slotsAvailable } from '../lib/portal-view';

export default function HomePage() {
  return (
    <section>
      <h1>Slots</h1>
      <p className="p">Abattoir confirms slaughter slots, halaal flag.</p>

      <table className="tbl">
        <thead>
          <tr><th>Date</th><th>Capacity</th><th>Booked</th><th>Available</th><th>Halaal</th></tr>
        </thead>
        <tbody>
          {DEMO_SLOTS.map((slot) => (
            <tr key={slot.id}>
              <td>{slot.date}</td>
              <td>{slot.capacity}</td>
              <td>{bookedPct(slot)}%</td>
              <td>{slotsAvailable(slot)}</td>
              <td>{slot.halaal ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <button className="btn" type="button">Confirm slot</button>
    </section>
  );
}
