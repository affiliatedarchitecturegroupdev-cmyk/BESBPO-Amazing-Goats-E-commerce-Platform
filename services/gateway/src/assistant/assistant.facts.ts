import type { PolicyDocument } from '@ag/policy';
import { formatZar, type Fact } from './assistant.rules';

/**
 * Turn platform rows into citable facts. Every function here is pure: it takes
 * a row the platform already has and composes the sentence the assistant is
 * allowed to say, including any price.
 *
 * This is where ADR 0013 s4 rule 1 is enforced. The model never sees a number
 * it can echo: the price is formatted here, from `priceCents`, and the model at
 * most chooses which fact to show.
 */

/** The subset of a catalogue row retrieval needs. */
export interface CatalogueRow {
  sku: string;
  name: string;
  pack: string;
  categorySlug?: string | null;
  fulfilment: string;
  temperature: string;
  halaalAvailable?: boolean;
  /** Integer cents, excluding VAT. Absent means price on request. */
  priceCents?: number;
}

/** What a fulfilment type means to a shopper, in the platform's own words. */
const FULFILMENT_TEXT: Record<string, string> = {
  in_stock: 'in stock',
  pre_order_cycle: 'ordered on the weekly cycle',
  reservation: 'by reservation',
  quote: 'price on request',
  seasonal_pre_order: 'seasonal pre-order',
};

/** The URL a product row is shown at. */
export function productUrl(sku: string): string {
  return `/product/${encodeURIComponent(sku)}`;
}

/**
 * A catalogue fact. The price is `formatZar` of the row's own cents, so an
 * answer quoting R209.00 is quoting the catalogue, not the model.
 */
export function productFact(row: CatalogueRow): Fact {
  const parts = [`${row.name} (${row.pack})`];
  parts.push(row.priceCents === undefined ? 'price on request' : `${formatZar(row.priceCents)} excluding VAT`);
  const fulfilment = FULFILMENT_TEXT[row.fulfilment] ?? row.fulfilment;
  parts.push(fulfilment);
  if (row.temperature === 'chilled') parts.push('chilled');
  if (row.temperature === 'frozen') parts.push('frozen');
  if (row.halaalAvailable) parts.push('halaal available');
  return {
    kind: 'product',
    id: `product:${row.sku}`,
    text: parts.join(', '),
    url: productUrl(row.sku),
    title: row.name,
  };
}

/** The cycle fields retrieval needs; dates are ISO strings from the commerce API. */
export interface CycleRow {
  cutoffAt?: string | null;
  tradeLockAt?: string | null;
  deliveryFrom?: string | null;
  deliveryTo?: string | null;
}

/** Render an ISO instant as a date a person reads, in SAST (UTC+2, all year). */
export function formatSastDate(at: string | null | undefined): string | undefined {
  if (!at) return undefined;
  const ms = Date.parse(at);
  if (!Number.isFinite(ms)) return undefined;
  const shifted = new Date(ms + 2 * 60 * 60 * 1000);
  const [day, time] = shifted.toISOString().split('T');
  return `${day} ${time.slice(0, 5)} SAST`;
}

/**
 * A cut-off fact. Delivery dates come from the cycle engine's own fields, never
 * from the model (ADR 0013 s4 rule 5), so an answer can only promise what the
 * platform has scheduled.
 */
export function cycleFacts(cycle: CycleRow): Fact[] {
  const facts: Fact[] = [];
  const cutoff = formatSastDate(cycle.cutoffAt);
  if (cutoff) {
    facts.push({
      kind: 'cycle',
      id: 'cycle:cutoff',
      text: `The public order cut-off is ${cutoff}.`,
      url: '/delivery',
      title: 'Order cut-off',
    });
  }
  const tradeLock = formatSastDate(cycle.tradeLockAt);
  if (tradeLock) {
    facts.push({
      kind: 'cycle',
      id: 'cycle:trade-lock',
      text: `Trade standing orders lock at ${tradeLock}.`,
      url: '/delivery',
      title: 'Trade lock',
    });
  }
  const from = formatSastDate(cycle.deliveryFrom);
  const to = formatSastDate(cycle.deliveryTo);
  if (from) {
    facts.push({
      kind: 'cycle',
      id: 'cycle:delivery',
      text: to ? `Delivery runs from ${from} to ${to}.` : `Delivery starts ${from}.`,
      url: '/delivery',
      title: 'Delivery window',
    });
  }
  return facts;
}

/** The zone fields retrieval needs. */
export interface ZoneRow {
  code: string;
  name?: string;
  feeCents?: number;
  minOrderCents?: number;
  days?: string[];
}

/**
 * A delivery-zone fact. A zone with a fee states the fee from its own cents;
 * a zone without one says so rather than leaving the number to a guess.
 */
export function zoneFact(zone: ZoneRow): Fact {
  const name = zone.name ?? zone.code;
  const parts = [`Deliveries to ${name}`];
  if (typeof zone.feeCents === 'number') parts.push(`cost ${formatZar(zone.feeCents)}`);
  if (typeof zone.minOrderCents === 'number') parts.push(`minimum order ${formatZar(zone.minOrderCents)}`);
  if (zone.days && zone.days.length > 0) parts.push(`on ${zone.days.join(', ')}`);
  return {
    kind: 'zone',
    id: `zone:${zone.code.toLowerCase()}`,
    text: `${parts.join(', ')}.`,
    url: '/delivery',
    title: `Delivery to ${name}`,
  };
}

/**
 * A policy fact, from one section of a published legal document.
 *
 * Bracketed `[placeholders]` are stripped: they are inputs the company has not
 * supplied (a phone number, an address), and an assistant that reads one out as
 * fact would invent a detail. A section left empty by the strip is dropped.
 */
export function policyFacts(doc: PolicyDocument): Fact[] {
  const facts: Fact[] = [];
  const version = doc.versions[doc.versions.length - 1];
  if (!version) return facts;
  const url = `/${doc.slug}`;
  for (const section of version.sections) {
    const paragraphs = section.paragraphs.map(stripPlaceholders).filter((p) => p.length > 0);
    const bullets = (section.bullets ?? []).map(stripPlaceholders).filter((b) => b.length > 0);
    const text = [...paragraphs, ...bullets].join(' ');
    if (text.length === 0) continue;
    facts.push({
      kind: 'policy',
      id: `policy:${doc.slug}:${slugify(section.heading)}`,
      text,
      url,
      title: `${doc.title}: ${section.heading}`,
    });
  }
  return facts;
}

/**
 * Remove `[bracketed company inputs]` and tidy the punctuation left behind, so
 * a sentence never reads "... reach us on  or by ." after the strip.
 */
export function stripPlaceholders(text: string): string {
  return text
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    // A label whose only value was a placeholder reads "Physical address:." once
    // the value goes, so collapse the dangling separator too.
    .replace(/[:;,·]+\s*([.!?])/g, '$1')
    .replace(/[\s:;,·]+$/, '')
    .trim();
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
}

/** The content fields retrieval needs; the storefront's content view. */
export interface ContentRow {
  slug: string;
  kind: string;
  title: string;
  summary?: string;
  html?: string;
}

/**
 * A published-content fact. The summary is preferred over the body: it is the
 * author's own one-line answer, so quoting it cannot misrepresent the article.
 * Markdown and HTML are stripped — the gateway never renders markup.
 */
export function contentFact(row: ContentRow): Fact | undefined {
  const summary = plainText(row.summary ?? row.html ?? '');
  if (summary.length === 0) return undefined;
  return {
    kind: 'content',
    id: `content:${row.kind}:${row.slug}`,
    text: summary,
    url: `/${row.kind === 'post' ? 'blog' : row.kind}/${row.slug}`,
    title: row.title,
  };
}

/** Strip tags and collapse whitespace, so a snippet is safe to quote as prose. */
export function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/[#*_>`]/g, '')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Build the whole fact set from whatever the platform could retrieve. */
export interface FactSources {
  catalogue?: CatalogueRow[];
  cycle?: CycleRow;
  zones?: ZoneRow[];
  policies?: PolicyDocument[];
  content?: ContentRow[];
}

export function buildFacts(sources: FactSources): Fact[] {
  const facts: Fact[] = [];
  for (const row of sources.catalogue ?? []) facts.push(productFact(row));
  if (sources.cycle) facts.push(...cycleFacts(sources.cycle));
  for (const zone of sources.zones ?? []) facts.push(zoneFact(zone));
  for (const doc of sources.policies ?? []) facts.push(...policyFacts(doc));
  for (const row of sources.content ?? []) {
    const fact = contentFact(row);
    if (fact) facts.push(fact);
  }
  return facts;
}
