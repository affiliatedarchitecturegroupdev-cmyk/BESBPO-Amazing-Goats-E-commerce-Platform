/**
 * The assistant's guardrails, as pure functions (ADR 0013 s4).
 *
 * A generic model bolted to a storefront will invent a price, promise a delivery
 * date and invent stock. For a food business that is a compliance problem
 * (R146 of 2010) and a commercial one (a quoted wrong price), so the rules that
 * stop it are here, testable without a network or a model:
 *
 * 1. A price in an answer comes from a catalogue row, never from the model.
 * 2. No retrieved fact means no answer.
 * 3. Refuse rather than improvise, with a fixed constant naming a human.
 * 4. Every answer cites the page it drew from.
 * 5. Delivery dates come from the cut-off engine.
 */

/** Where a person can reach a human. The refusal points here rather than improvising. */
export const HUMAN_CHANNEL_PATH = '/contact';
export const HUMAN_CHANNEL_LABEL = 'Contact us';

/**
 * The refusal. A constant, not model output: an improvised apology is how a
 * model starts explaining something it does not know (ADR 0013 s4 rule 3).
 *
 * It names a *page*, not a phone number or address. Those are still
 * `[bracketed placeholders]` in `packages/policy`, and quoting a placeholder as
 * a fact is exactly the kind of invented detail this card exists to prevent.
 */
export const REFUSAL_ANSWER =
  `I can only answer from what is published on the shop, and I don't have that here. ` +
  `For anything else, please reach a person: ${HUMAN_CHANNEL_PATH}`;

/** The citation a refusal carries, so the customer has somewhere to go. */
export const REFUSAL_CITATION = { title: HUMAN_CHANNEL_LABEL, url: HUMAN_CHANNEL_PATH };

/** The kinds of fact the assistant may answer from (ADR 0013 s4 rule 2). */
export const FACT_KINDS = ['product', 'cycle', 'zone', 'policy', 'content'] as const;
export type FactKind = (typeof FACT_KINDS)[number];

/**
 * One retrieved fact: a row a person can check. `id` is stable and is what the
 * conversation log records, so a disputed answer can be reconstructed.
 */
export interface Fact {
  kind: FactKind;
  /** Stable, checkable: `product:AG-LM-002`, `policy:returns`, `zone:ballito`. */
  id: string;
  /** What the answer may say, already composed by code from the row. */
  text: string;
  /** Where a reader can verify it. */
  url: string;
  title: string;
}

export interface Citation {
  title: string;
  url: string;
}

/**
 * Instruction patterns that mean the question is trying to rewrite the rules.
 * A storefront question never needs these; an injected one nearly always has
 * one. This is a filter, not the defence: the defence is that the model never
 * sees a price and never composes the answer from its own knowledge.
 */
const INJECTION_PATTERNS: RegExp[] = [
  /\bignore\s+(all\s+|any\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)/i,
  /\bdisregard\s+(all\s+|any\s+)?(previous|prior|above|earlier|your)\s+(instructions?|prompts?|rules?|guidelines?)/i,
  /\b(reveal|show|print|repeat|output|tell\s+me)\b[^.?!]{0,30}\b(system\s+prompt|your\s+prompt|your\s+instructions|initial\s+prompt)/i,
  /\byou\s+are\s+now\b/i,
  /\bact\s+as\s+(a|an|the)\b/i,
  /\bpretend\s+(to\s+be|you\s+are)\b/i,
  /\b(jailbreak|developer\s+mode|dan\s+mode)\b/i,
  /\boverride\s+(your|the)\s+(rules?|instructions?|guardrails?)/i,
  /\bnew\s+(system\s+)?instructions?\s*:/i,
  /<\/?(system|assistant|user)>/i,
  /<\|im_start\|>|<\|im_end\|>/i,
];

/** True when the question looks like an attempt to change the rules. */
export function looksLikeInjection(question: string): boolean {
  return INJECTION_PATTERNS.some((re) => re.test(question));
}

/**
 * Whether the answer may be given at all. A question that tried to rewrite the
 * rules gets the refusal even when retrieval would have found something, so the
 * response never rewards the attempt (ADR 0013 s4 rule 3).
 */
export function mustRefuse(question: string, facts: readonly Fact[]): boolean {
  if (looksLikeInjection(question)) return true;
  return facts.length === 0;
}

/** Format integer cents as rands. Same shape as the storefront's `formatRand`. */
export function formatZar(cents: number): string {
  const negative = cents < 0;
  const whole = Math.abs(Math.round(cents)) / 100;
  const [rand, frac] = whole.toFixed(2).split('.');
  const grouped = rand.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${negative ? '-' : ''}R${grouped}.${frac}`;
}

/**
 * Compose the answer from retrieved facts only.
 *
 * The model, when one is configured, chooses *which* facts to mention; it never
 * supplies their text. That is what makes rule 1 hold: a price that appears in
 * an answer is a `formatZar` call on a row, not a string a model produced.
 */
export function composeAnswer(facts: readonly Fact[], limit = 4): string {
  const shown = facts.slice(0, limit);
  if (shown.length === 0) return REFUSAL_ANSWER;
  const lines = shown.map((f) => `- ${f.text}`);
  return `${lines.join('\n')}\n\nI've linked where each of these comes from.`;
}

/** The distinct citations for the facts an answer actually used. */
export function citationsFor(facts: readonly Fact[], limit = 4): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const fact of facts.slice(0, limit)) {
    if (seen.has(fact.url)) continue;
    seen.add(fact.url);
    out.push({ title: fact.title, url: fact.url });
  }
  return out;
}

/** The ids the conversation log records, so the answer can be reconstructed. */
export function factIds(facts: readonly Fact[]): string[] {
  return facts.map((f) => f.id);
}

export interface AssistantAnswer {
  answer: string;
  citations: Citation[];
  refused: boolean;
}

/**
 * The one entry point: given a question and what retrieval found, decide
 * whether to answer, compose it from facts, and cite it.
 */
export function answerQuestion(question: string, facts: readonly Fact[]): AssistantAnswer {
  if (mustRefuse(question, facts)) {
    return { answer: REFUSAL_ANSWER, citations: [REFUSAL_CITATION], refused: true };
  }
  return { answer: composeAnswer(facts), citations: citationsFor(facts), refused: false };
}

/**
 * Keywords for retrieval: lowercased, punctuation stripped, stop words removed.
 * Deliberately simple and inspectable (ADR 0013 s4: no vector database at
 * launch). A question that shares no keyword with a fact retrieves nothing,
 * which is the correct behaviour and a signal to write content.
 */
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'could', 'do', 'does',
  'for', 'from', 'get', 'has', 'have', 'how', 'i', 'if', 'in', 'is', 'it', 'its', 'me',
  'much', 'my', 'of', 'on', 'or', 'please', 'so', 'that', 'the', 'their', 'them', 'there',
  'these', 'they', 'this', 'to', 'was', 'we', 'were', 'what', 'when', 'where', 'which',
  'who', 'why', 'will', 'with', 'would', 'you', 'your',
]);

export function keywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/** How many keywords a fact must share with a question to be worth returning. */
export const MIN_KEYWORD_HITS = 1;

/**
 * How much of the question a fact must account for.
 *
 * A single shared word is not evidence. Long policy prose contains most common
 * commerce verbs ("sell", "order", "delivery"), so a one-hit rule answers "do
 * you sell crocodile biltong" from the About page — an answer built on nothing.
 * Requiring half the question's keywords keeps a real question answerable while
 * sending a question the corpus does not cover to the refusal.
 */
export const MIN_KEYWORD_COVERAGE = 0.5;

/**
 * Score a fact against the question's keywords. The score is the number of
 * distinct keywords found, so a two-word match outranks a one-word match and
 * the ordering is explainable without a model.
 */
export function scoreFact(fact: Fact, words: readonly string[]): number {
  const haystack = `${fact.title} ${fact.text}`.toLowerCase();
  let score = 0;
  for (const w of words) if (haystack.includes(w)) score += 1;
  return score;
}

/** True when a score accounts for enough of the question to be worth showing. */
export function coversQuestion(score: number, wordCount: number): boolean {
  if (score < MIN_KEYWORD_HITS || wordCount === 0) return false;
  return score / wordCount >= MIN_KEYWORD_COVERAGE;
}

/**
 * How many facts mention each keyword. This is what makes the refusal honest:
 * a word no fact contains means the corpus holds nothing about it, which is
 * rule 2 ("no retrieved fact means no answer") applied to the question's topic
 * rather than to the whole set.
 */
export function documentFrequency(facts: readonly Fact[], words: readonly string[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const word of words) {
    let count = 0;
    for (const fact of facts) {
      if (`${fact.title} ${fact.text}`.toLowerCase().includes(word)) count += 1;
    }
    df.set(word, count);
  }
  return df;
}

/**
 * Rank facts for a question, dropping those below the threshold.
 *
 * Two gates, both explainable without a model:
 *
 * - Every keyword must appear in at least one fact. A question naming something
 *   the platform never mentions ("crocodile") has no fact behind it, and a
 *   partial match against long policy prose would otherwise answer a question
 *   the corpus does not cover.
 * - A fact must account for at least `MIN_KEYWORD_COVERAGE` of the question, so
 *   one incidental word ("sell") is not enough.
 */
export function rankFacts(facts: readonly Fact[], question: string): Fact[] {
  const words = keywords(question);
  if (words.length === 0) return [];
  const df = documentFrequency(facts, words);
  for (const count of df.values()) if (count === 0) return [];

  const ranked = facts
    .map((fact) => ({ fact, score: scoreFact(fact, words) }))
    .filter((s) => coversQuestion(s.score, words.length))
    .sort((a, b) => b.score - a.score)
    .map((s) => s.fact);

  // ADR 0013 s4 splits retrieval: a product query is answered from catalogue
  // rows, and only a question no product matches runs the keyword search over
  // content and policies. Without the split, long policy prose competes with a
  // product row and pads a price answer with an essay.
  const products = ranked.filter((f) => f.kind === 'product');
  return products.length > 0 ? products : ranked;
}

/**
 * Strip anything personal from a question before it is logged. The conversation
 * log is POPIA personal data, so it is minimised: an email, a phone number or a
 * long digit run is replaced, and the rest is kept so the answer stays
 * reconstructable alongside the fact ids.
 */
export function redactQuestion(question: string): string {
  return question
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    // A phone is matched on a digit boundary so a longer run is not half-eaten,
    // and before the generic run so an 0-prefixed number reads as a phone.
    .replace(/(?<!\d)(?:\+27|0)\d{9}(?!\d)/g, '[phone]')
    .replace(/(?<!\d)\d{6,}(?!\d)/g, '[number]');
}
