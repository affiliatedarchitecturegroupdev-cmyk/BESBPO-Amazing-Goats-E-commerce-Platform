import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  isRenderableRecipe,
  parseIngredient,
  parseRecipeDetail,
  parseStep,
  totalMinutes,
} from './recipe.rules';

describe('parseIngredient', () => {
  it('reads quantity, item and note', () => {
    expect(parseIngredient({ quantity: '2 kg', item: 'lamb shoulder', note: 'bone in' })).toEqual({
      quantity: '2 kg',
      item: 'lamb shoulder',
      note: 'bone in',
    });
  });

  it('accepts a bare string as the item', () => {
    expect(parseIngredient('salt')).toEqual({ item: 'salt' });
  });

  it('omits an empty quantity rather than rendering a blank', () => {
    expect(parseIngredient({ quantity: '   ', item: 'salt' })).toEqual({ item: 'salt' });
  });

  it('drops an entry with no item, because it is not an ingredient', () => {
    expect(parseIngredient({ quantity: '2 kg' })).toBeUndefined();
    expect(parseIngredient({})).toBeUndefined();
    expect(parseIngredient(null)).toBeUndefined();
    expect(parseIngredient(42)).toBeUndefined();
    expect(parseIngredient('   ')).toBeUndefined();
  });

  it('trims surrounding whitespace', () => {
    expect(parseIngredient({ item: '  parsley  ' })).toEqual({ item: 'parsley' });
  });
});

describe('parseStep', () => {
  it('reads the text of an object step', () => {
    expect(parseStep({ text: 'Brown the meat.' })).toEqual({ text: 'Brown the meat.' });
  });

  it('accepts a bare string step', () => {
    expect(parseStep('Brown the meat.')).toEqual({ text: 'Brown the meat.' });
  });

  it('drops a step with no text', () => {
    expect(parseStep({ text: '  ' })).toBeUndefined();
    expect(parseStep({ order: 1 })).toBeUndefined();
  });
});

describe('parseRecipeDetail', () => {
  it('keeps valid entries and drops the malformed ones', () => {
    const detail = parseRecipeDetail({
      servings: 4,
      prep_minutes: 20,
      cook_minutes: 180,
      ingredients: [{ item: 'lamb neck' }, 'salt', { quantity: '2' }, 7],
      steps: [{ text: 'Brown it.' }, { nothing: true }, 'Simmer.'],
    });
    expect(detail.ingredients).toEqual([{ item: 'lamb neck' }, { item: 'salt' }]);
    expect(detail.steps).toEqual([{ text: 'Brown it.' }, { text: 'Simmer.' }]);
  });

  it('treats a non-array jsonb value as empty rather than throwing', () => {
    const detail = parseRecipeDetail({ servings: 2, ingredients: { item: 'x' }, steps: null });
    expect(detail.ingredients).toEqual([]);
    expect(detail.steps).toEqual([]);
  });

  it('floors servings at 1 so the page never says "serves 0"', () => {
    expect(parseRecipeDetail({ servings: 0 }).servings).toBe(1);
    expect(parseRecipeDetail({ servings: -3 }).servings).toBe(1);
    expect(parseRecipeDetail({}).servings).toBe(1);
  });

  it('reads numeric strings from the driver as numbers', () => {
    const detail = parseRecipeDetail({ servings: '6', prep_minutes: '15', cook_minutes: '45' });
    expect(detail.servings).toBe(6);
    expect(detail.prepMinutes).toBe(15);
    expect(detail.cookMinutes).toBe(45);
  });
});

describe('totalMinutes and formatDuration', () => {
  it('adds prep to cook', () => {
    expect(totalMinutes({ prepMinutes: 20, cookMinutes: 180 })).toBe(200);
  });

  it('ignores a negative component', () => {
    expect(totalMinutes({ prepMinutes: -10, cookMinutes: 30 })).toBe(30);
  });

  it('reads as minutes under an hour', () => {
    expect(formatDuration(45)).toBe('45 min');
  });

  it('drops a zero minute remainder', () => {
    expect(formatDuration(120)).toBe('2 hr');
  });

  it('keeps both parts when there is a remainder', () => {
    expect(formatDuration(200)).toBe('3 hr 20 min');
  });

  it('says so rather than printing "0 min"', () => {
    expect(formatDuration(0)).toBe('No time given');
    expect(formatDuration(-5)).toBe('No time given');
    expect(formatDuration(Number.NaN)).toBe('No time given');
  });
});

describe('isRenderableRecipe', () => {
  const detail = parseRecipeDetail({
    servings: 4,
    ingredients: [{ item: 'lamb' }],
    steps: [{ text: 'Cook it.' }],
  });

  it('needs both ingredients and steps', () => {
    expect(isRenderableRecipe(detail)).toBe(true);
    expect(isRenderableRecipe({ ...detail, steps: [] })).toBe(false);
    expect(isRenderableRecipe({ ...detail, ingredients: [] })).toBe(false);
  });
});
