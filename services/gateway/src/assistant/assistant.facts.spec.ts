import { describe, expect, it } from 'vitest';
import { policyBySlug } from '@ag/policy';
import {
  buildFacts,
  contentFact,
  cycleFacts,
  formatSastDate,
  plainText,
  policyFacts,
  productFact,
  stripPlaceholders,
  zoneFact,
  type CatalogueRow,
} from './assistant.facts';
import { formatZar } from './assistant.rules';

const row = (over: Partial<CatalogueRow> = {}): CatalogueRow => ({
  sku: 'AG-LM-002',
  name: 'Lamb loin chops',
  pack: '500 g',
  fulfilment: 'in_stock',
  temperature: 'chilled',
  priceCents: 20900,
  ...over,
});

describe('productFact', () => {
  /**
   * The card's central rule: a price in an answer equals the catalogue row's
   * value. The assertion is against `formatZar` of the same cents the row
   * carries, so the two can only drift if the builder stops using the row.
   */
  it('states exactly the catalogue price, formatted from the row cents', () => {
    const fact = productFact(row());
    expect(fact.text).toContain(formatZar(20900));
    expect(fact.text).toContain('R209.00');
  });

  it('tracks a different row rather than a constant', () => {
    expect(productFact(row({ priceCents: 159900 })).text).toContain('R1 599.00');
  });

  it('says prices exclude VAT, the platform rule (docs/13-pricing.md)', () => {
    expect(productFact(row()).text).toContain('excluding VAT');
  });

  it('says price on request when the row has no price', () => {
    const fact = productFact(row({ priceCents: undefined }));
    expect(fact.text).toContain('price on request');
    expect(fact.text).not.toMatch(/R\d/);
  });

  it('never states a price for a quote row, even if one is present', () => {
    const fact = productFact(row({ fulfilment: 'quote', priceCents: undefined }));
    expect(fact.text).not.toMatch(/R\d/);
  });

  it('links to the product page by SKU', () => {
    expect(productFact(row()).url).toBe('/product/AG-LM-002');
    expect(productFact(row()).id).toBe('product:AG-LM-002');
  });

  it('mentions halaal only when the row says so', () => {
    expect(productFact(row({ halaalAvailable: true })).text).toContain('halaal available');
    expect(productFact(row({ halaalAvailable: false })).text).not.toContain('halaal');
  });

  it('describes fulfilment in shopper language', () => {
    expect(productFact(row({ fulfilment: 'pre_order_cycle' })).text).toContain('weekly cycle');
  });
});

describe('formatSastDate', () => {
  it('renders an instant in SAST (UTC+2)', () => {
    // 15:00 UTC is 17:00 in Johannesburg.
    expect(formatSastDate('2026-11-15T15:00:00.000Z')).toBe('2026-11-15 17:00 SAST');
  });

  it('returns undefined for a missing or unparseable value', () => {
    expect(formatSastDate(undefined)).toBeUndefined();
    expect(formatSastDate(null)).toBeUndefined();
    expect(formatSastDate('not a date')).toBeUndefined();
  });
});

describe('cycleFacts', () => {
  it('states the cut-off from the cycle, not from a model', () => {
    const facts = cycleFacts({ cutoffAt: '2026-11-15T15:00:00.000Z' });
    expect(facts).toHaveLength(1);
    expect(facts[0].text).toContain('2026-11-15 17:00 SAST');
    expect(facts[0].id).toBe('cycle:cutoff');
  });

  it('states a delivery window when the cycle has one', () => {
    const facts = cycleFacts({
      deliveryFrom: '2026-11-18T04:00:00.000Z',
      deliveryTo: '2026-11-20T16:00:00.000Z',
    });
    const window = facts.find((f) => f.id === 'cycle:delivery');
    expect(window?.text).toContain('2026-11-18 06:00 SAST');
    expect(window?.text).toContain('2026-11-20 18:00 SAST');
  });

  it('emits nothing for an empty cycle rather than guessing', () => {
    expect(cycleFacts({})).toEqual([]);
  });
});

describe('zoneFact', () => {
  it('states the fee from the zone cents', () => {
    const fact = zoneFact({ code: 'ballito', name: 'Ballito', feeCents: 6500 });
    expect(fact.text).toContain('R65.00');
    expect(fact.id).toBe('zone:ballito');
  });

  it('omits a fee it does not have', () => {
    expect(zoneFact({ code: 'kloof', name: 'Kloof' }).text).not.toMatch(/R\d/);
  });

  it('lists the route days', () => {
    expect(zoneFact({ code: 'ballito', days: ['Wednesday', 'Friday'] }).text).toContain('Wednesday, Friday');
  });
});

describe('stripPlaceholders', () => {
  it('removes a bracketed company input and the label it leaves dangling', () => {
    expect(stripPlaceholders('Orders and delivery: [phone] · [email]')).toBe('Orders and delivery');
  });

  it('keeps the sentence when only the value was a placeholder', () => {
    expect(stripPlaceholders('Physical address: [street address, suburb, city, postal code].')).toBe(
      'Physical address.',
    );
  });

  it('leaves real prose untouched', () => {
    expect(stripPlaceholders('The cut-off is what matters.')).toBe('The cut-off is what matters.');
  });
});

describe('policyFacts', () => {
  const returns = policyBySlug('returns');

  it('finds a published policy document', () => {
    expect(returns).toBeDefined();
  });

  it('builds one fact per section, with an id per section', () => {
    const facts = policyFacts(returns!);
    expect(facts.length).toBeGreaterThan(0);
    expect(facts.every((f) => f.kind === 'policy')).toBe(true);
    expect(facts.every((f) => f.id.startsWith('policy:returns:'))).toBe(true);
  });

  it('never quotes a bracketed placeholder as a fact', () => {
    for (const slug of ['contact', 'privacy', 'terms', 'returns'] as const) {
      const doc = policyBySlug(slug)!;
      for (const fact of policyFacts(doc)) {
        expect(fact.text).not.toMatch(/\[[^\]]*\]/);
      }
    }
  });

  it('links to the policy page', () => {
    expect(policyFacts(returns!)[0].url).toBe('/returns');
  });
});

describe('contentFact', () => {
  it('quotes the author summary', () => {
    const fact = contentFact({ slug: 'braai-lamb', kind: 'post', title: 'Braai lamb', summary: 'How to braai a leg.' });
    expect(fact?.text).toBe('How to braai a leg.');
    expect(fact?.url).toBe('/blog/braai-lamb');
  });

  it('strips markup rather than quoting it', () => {
    const fact = contentFact({ slug: 'x', kind: 'guide', title: 'X', summary: '<p>Use <b>salt</b>.</p>' });
    expect(fact?.text).toBe('Use salt.');
    expect(fact?.text).not.toContain('<');
  });

  it('drops a row with nothing to quote', () => {
    expect(contentFact({ slug: 'empty', kind: 'post', title: 'Empty' })).toBeUndefined();
  });
});

describe('plainText', () => {
  it('collapses tags and whitespace', () => {
    expect(plainText('<h2>Title</h2>\n\n  <p>Body</p>')).toBe('Title Body');
  });
});

describe('buildFacts', () => {
  it('builds from every source at once', () => {
    const facts = buildFacts({
      catalogue: [row()],
      cycle: { cutoffAt: '2026-11-15T15:00:00.000Z' },
      zones: [{ code: 'ballito', name: 'Ballito', feeCents: 6500 }],
      policies: [policyBySlug('returns')!],
      content: [{ slug: 'braai-lamb', kind: 'post', title: 'Braai lamb', summary: 'How to braai.' }],
    });
    const kinds = new Set(facts.map((f) => f.kind));
    expect(kinds).toEqual(new Set(['product', 'cycle', 'zone', 'policy', 'content']));
  });

  it('is empty when nothing was retrieved', () => {
    expect(buildFacts({})).toEqual([]);
  });

  it('gives every fact a unique id, so the log can name one', () => {
    const facts = buildFacts({
      catalogue: [row(), row({ sku: 'AG-LM-003', name: 'Lamb neck' })],
      policies: [policyBySlug('returns')!, policyBySlug('terms')!],
    });
    const ids = facts.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
