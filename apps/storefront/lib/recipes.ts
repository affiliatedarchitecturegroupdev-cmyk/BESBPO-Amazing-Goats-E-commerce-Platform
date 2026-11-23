import type { StorefrontItem } from './catalog';

/**
 * The guest-to-quantity calculator (T-055, wireframe `sf-recipes`).
 *
 * "How much meat for N guests" is the question that decides whether a shopper
 * orders a box or nothing at all, so the answer is a pure function of the guest
 * count and the meal, and it is deliberately conservative: it rounds up to the
 * next half kilogram, because a host who runs short cannot fix it on the day.
 *
 * The per-guest weights are planning figures for a South African braai or
 * Sunday lunch, where the meat is the centre of the plate and there are starch
 * and salad sides. They are named here rather than buried in a component so a
 * change is a reviewed number, not a diff in a page.
 */

/** The meals the calculator offers, with the grams of meat per adult guest. */
export interface MealProfile {
  key: string;
  label: string;
  /** Grams of raw meat per adult guest. */
  gramsPerGuest: number;
  /** One line of guidance shown under the answer. */
  note: string;
}

export const MEAL_PROFILES: MealProfile[] = [
  {
    key: 'braai',
    label: 'Braai',
    // 550 g matches the wireframe's own worked example: 12 braai guests, about 7 kg.
    gramsPerGuest: 550,
    note: 'Braai portions are generous and bone-in cuts weigh more than they yield.',
  },
  {
    key: 'roast',
    label: 'Sunday roast',
    gramsPerGuest: 400,
    note: 'A boneless roast serves more people per kilogram than a bone-in joint.',
  },
  {
    key: 'potjie',
    label: 'Potjie',
    gramsPerGuest: 350,
    note: 'A potjie stretches the meat with vegetables and starch.',
  },
  {
    key: 'catering',
    label: 'Catering platter',
    gramsPerGuest: 250,
    note: 'Platters assume several dishes are served alongside the meat.',
  },
];

/** Children eat less, so a child counts as this fraction of an adult guest. */
export const CHILD_FACTOR = 0.6;

/** The meal profile for a key, defaulting to the braai. */
export function mealProfile(key: string): MealProfile {
  return MEAL_PROFILES.find((m) => m.key === key) ?? MEAL_PROFILES[0];
}

export interface GuestCount {
  adults: number;
  children: number;
}

/** Guests as adult-equivalents, so children are counted without a second table. */
export function adultEquivalent(guests: GuestCount): number {
  const adults = Math.max(0, Math.floor(guests.adults));
  const children = Math.max(0, Math.floor(guests.children));
  return adults + children * CHILD_FACTOR;
}

/** Round up to the next half kilogram, the way meat is actually sold. */
export function roundUpToHalfKg(grams: number): number {
  if (grams <= 0) return 0;
  return Math.ceil(grams / 500) / 2;
}

export interface GuestEstimate {
  /** The suggested weight in kilograms, rounded up to the next half kilogram. */
  kg: number;
  /** The unrounded weight, for the "about" line. */
  rawKg: number;
  /** The adult-equivalent guest count the estimate is built on. */
  adultEquivalents: number;
  meal: MealProfile;
  /** The guidance line for this meal. */
  note: string;
}

/**
 * How much meat to buy for a table. A zero-guest table asks for nothing rather
 * than a minimum, so the page never invents a sale.
 */
export function estimateMeat(guests: GuestCount, mealKey: string): GuestEstimate {
  const meal = mealProfile(mealKey);
  const equivalents = adultEquivalent(guests);
  const rawKg = (equivalents * meal.gramsPerGuest) / 1000;
  return {
    kg: roundUpToHalfKg(rawKg * 1000),
    rawKg: Math.round(rawKg * 100) / 100,
    adultEquivalents: equivalents,
    meal,
    note: meal.note,
  };
}

/**
 * The catalogue lines that suit a meal, cheapest first, so the calculator can
 * point at something the shopper can actually buy. An empty result is honest:
 * the estimate stands on its own when the catalogue has no matching line.
 */
export function suggestForMeal(items: StorefrontItem[], mealKey: string, limit = 3): StorefrontItem[] {
  const wanted = mealKey === 'braai' ? ['lamb', 'boerewors'] : ['lamb'];
  const matches = (item: StorefrontItem): boolean => {
    // `category` is derived from the category slug or a slugified line name, and
    // the lamb line is named "Lamb (flagship)", so a prefix test on either field
    // is what actually finds the line.
    const haystack = `${item.category ?? ''} ${item.line ?? ''}`.toLowerCase();
    return wanted.some((word) => haystack.includes(word));
  };
  return items
    .filter((i) => i.priceCents != null && matches(i))
    .sort((a, b) => (a.priceCents ?? 0) - (b.priceCents ?? 0))
    .slice(0, limit);
}

/** One row of the cut guide: which cut, how to cook it, how to store it. */
export interface CutGuideEntry {
  cut: string;
  cook: string;
  store: string;
}

/**
 * The cut guide (wireframe `sf-recipes`: "Which cut, how to cook, how to
 * store"). These are the lines the catalogue actually carries, so a reader can
 * go from the guide to a product rather than to a cut we do not sell.
 */
export const CUT_GUIDE: CutGuideEntry[] = [
  { cut: 'Loin chops', cook: 'Hot and fast over coals, 3 to 4 minutes a side', store: 'Chilled, 3 days; freeze up to 3 months' },
  { cut: 'Neck', cook: 'Slow potjie or stew, 2 hours until it falls off the bone', store: 'Chilled, 2 days; freeze up to 3 months' },
  { cut: 'Shoulder', cook: 'Low oven roast at 160 °C, 25 minutes per 500 g', store: 'Chilled, 3 days; freeze up to 4 months' },
  { cut: 'Leg', cook: 'Roast whole, or butterfly and braai over medium coals', store: 'Chilled, 3 days; freeze up to 4 months' },
  { cut: 'Shanks', cook: 'Braise 2.5 to 3 hours; the marrow thickens the gravy', store: 'Chilled, 2 days; freeze up to 3 months' },
  { cut: 'Ribs', cook: 'Slow then hot: 2 hours covered, then 10 minutes to crisp', store: 'Chilled, 3 days; freeze up to 3 months' },
];
