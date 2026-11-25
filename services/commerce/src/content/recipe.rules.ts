/**
 * Recipe detail rules (T-072), as pure functions.
 *
 * The interesting part is `parseRecipeDetail`. The database constrains
 * `ingredients` and `steps` to be *arrays*, and nothing more: an array of numbers
 * or of objects missing their text satisfies the CHECK. So the shape a page
 * renders has to be established here, once, rather than trusted from `jsonb`.
 * Malformed entries are dropped rather than thrown on, because one bad step must
 * not turn a published recipe into a 500 for every reader.
 */

export interface RecipeIngredient {
  /** Free text: "2 kg", "a handful", "to taste". Not a catalogue quantity. */
  quantity?: string;
  /** The thing itself: "lamb shoulder", "parsley". */
  item: string;
  /** An aside: "bone in", "finely chopped". */
  note?: string;
}

export interface RecipeStep {
  text: string;
}

export interface RecipeDetail {
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
}

/** What a `jsonb` column holds before it is parsed: not to be trusted. */
export type RawJson = unknown;

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function count(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * One ingredient from an untyped row. An entry with no `item` is not an
 * ingredient — it is a stray value — so it is dropped rather than rendered as a
 * blank line in the list.
 */
export function parseIngredient(raw: unknown): RecipeIngredient | undefined {
  if (typeof raw === 'string') {
    const item = text(raw);
    return item ? { item } : undefined;
  }
  if (typeof raw !== 'object' || raw === null) return undefined;
  const row = raw as Record<string, unknown>;
  const item = text(row.item);
  if (!item) return undefined;
  const quantity = text(row.quantity);
  const note = text(row.note);
  return { item, ...(quantity ? { quantity } : {}), ...(note ? { note } : {}) };
}

export function parseStep(raw: unknown): RecipeStep | undefined {
  if (typeof raw === 'string') {
    const value = text(raw);
    return value ? { text: value } : undefined;
  }
  if (typeof raw !== 'object' || raw === null) return undefined;
  const value = text((raw as Record<string, unknown>).text);
  return value ? { text: value } : undefined;
}

/**
 * A stored recipe row, made safe to render. `servings` floors at 1 because a
 * recipe that serves nobody cannot be scaled, and the page shows "Serves 1"
 * rather than "Serves 0".
 */
export function parseRecipeDetail(row: {
  servings?: unknown;
  prep_minutes?: unknown;
  cook_minutes?: unknown;
  ingredients?: RawJson;
  steps?: RawJson;
}): RecipeDetail {
  return {
    servings: Math.max(1, count(row.servings)),
    prepMinutes: count(row.prep_minutes),
    cookMinutes: count(row.cook_minutes),
    ingredients: array(row.ingredients)
      .map(parseIngredient)
      .filter((i): i is RecipeIngredient => i !== undefined),
    steps: array(row.steps)
      .map(parseStep)
      .filter((s): s is RecipeStep => s !== undefined),
  };
}

/** Total time a cook is committing to. Prep and cook are separate on the page
 * because "20 min prep, 3 hr in the oven" is a different decision from
 * "3 hr 20 min of work". */
export function totalMinutes(detail: Pick<RecipeDetail, 'prepMinutes' | 'cookMinutes'>): number {
  return Math.max(0, detail.prepMinutes) + Math.max(0, detail.cookMinutes);
}

/**
 * A duration a person reads: "45 min", "1 hr", "2 hr 30 min". Zero returns
 * "No time given" rather than "0 min", which reads like a mistake.
 */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return 'No time given';
  const whole = Math.round(minutes);
  const hours = Math.floor(whole / 60);
  const mins = whole % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
}

/** Whether a recipe has enough to be worth a page. A published recipe with no
 * steps is a recipe the reader cannot cook, so the detail page treats it as
 * absent rather than rendering an empty shell. */
export function isRenderableRecipe(detail: RecipeDetail): boolean {
  return detail.steps.length > 0 && detail.ingredients.length > 0;
}
