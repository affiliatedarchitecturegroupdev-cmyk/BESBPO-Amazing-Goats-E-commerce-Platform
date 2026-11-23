'use client';
import { useState } from 'react';
import { MEAL_PROFILES, estimateMeat } from '../lib/recipes';

/**
 * The guest calculator (T-055, wireframe `sf-recipes`, flow A9).
 *
 * "How much meat for N guests" is answered in the browser because it is pure
 * arithmetic on the guest count: no catalogue read, no round trip, and the
 * answer updates as the number changes. The rule itself lives in
 * `lib/recipes.ts` so the copy and the maths are testable without a DOM.
 */
export function GuestCalculator() {
  const [adults, setAdults] = useState(12);
  const [children, setChildren] = useState(0);
  const [meal, setMeal] = useState(MEAL_PROFILES[0].key);

  const estimate = estimateMeat({ adults, children }, meal);

  return (
    <section className="card" aria-labelledby="guest-calculator">
      <h2 id="guest-calculator">How much meat for your table?</h2>
      <p className="p">
        Tell us the table and the meal, and we will suggest a weight. Portions are generous for a braai
        and lighter for a potjie.
      </p>

      <div className="grid">
        <div className="fld">
          <label htmlFor="calc-adults">Adults</label>
          <input
            id="calc-adults"
            type="number"
            min={0}
            max={500}
            value={adults}
            onChange={(e) => setAdults(Number(e.target.value))}
          />
        </div>
        <div className="fld">
          <label htmlFor="calc-children">Children</label>
          <input
            id="calc-children"
            type="number"
            min={0}
            max={500}
            value={children}
            onChange={(e) => setChildren(Number(e.target.value))}
          />
        </div>
        <div className="fld">
          <label htmlFor="calc-meal">Meal</label>
          <select id="calc-meal" value={meal} onChange={(e) => setMeal(e.target.value)}>
            {MEAL_PROFILES.map((profile) => (
              <option key={profile.key} value={profile.key}>{profile.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div role="status" aria-live="polite">
        {estimate.kg === 0 ? (
          <p className="p">Add a guest to see a suggested weight.</p>
        ) : (
          <>
            <p className="p">
              <strong>{estimate.kg} kg</strong> of meat for {estimate.adultEquivalents} adult-equivalents.
            </p>
            <p className="p">{estimate.note}</p>
          </>
        )}
      </div>
    </section>
  );
}
