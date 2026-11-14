import { CatalogueFilters, CatalogueItem } from './catalog.types';

/** Split a filter value on whitespace and hyphens, e.g. AG-LG -> [ag, lg]. */
function normalize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[\s-]+/)
    .filter(Boolean);
}

/**
 * Keep only the items that match every provided filter. Filters are combined
 * with AND; `line` matches the code or the name, `category` the slug.
 */
export function applyFilters(items: CatalogueItem[], filters: CatalogueFilters): CatalogueItem[] {
  const line = filters.line ? normalize(filters.line) : null;
  const category = filters.category?.toLowerCase() ?? null;

  return items.filter((item) => {
    if (line && !line.every((t) => `${item.lineCode} ${item.lineName}`.toLowerCase().includes(t))) return false;
    if (category && (item.categorySlug ?? '').toLowerCase() !== category) return false;
    if (filters.fulfilment && item.fulfilment !== filters.fulfilment) return false;
    if (filters.channel && item.channel !== filters.channel) return false;
    if (filters.phase !== undefined && item.phase !== filters.phase) return false;
    if (filters.temperature && item.temperature !== filters.temperature) return false;
    return true;
  });
}

/** Levenshtein edit distance, iterative with a single row (O(n) memory). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Similarity in [0,1] that tolerates typos without matching unrelated words.
 * A shared prefix counts (so a prefix of a term is a near match), and a small
 * length bonus keeps one-edit differences from scoring too high on short words.
 */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const distance = levenshtein(a, b);
  const prefix = commonPrefixLength(a, b);
  if (prefix >= 3 && Math.abs(a.length - b.length) <= 2) return 1 - distance / (2 * Math.max(a.length, b.length));
  return 1 - distance / Math.max(a.length, b.length);
}

function commonPrefixLength(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

/** Tokens a query or item is matched on: name, SKU and pack. */
export function searchTokens(item: CatalogueItem): string[] {
  const words = `${item.name} ${item.sku} ${item.pack}`.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return [...new Set(words)];
}

/** Score one item against the query tokens: the mean best-token similarity. */
export function scoreItem(queryTokens: string[], item: CatalogueItem): number {
  const tokens = searchTokens(item);
  if (tokens.length === 0 || queryTokens.length === 0) return 0;
  const total = queryTokens.reduce((sum, q) => {
    let best = 0;
    for (const t of tokens) best = Math.max(best, similarity(q, t));
    return sum + best;
  }, 0);
  return total / queryTokens.length;
}

/** Rank items by score (then SKU for stability), dropping those below minScore. */
export function rankItems(query: string, items: CatalogueItem[], minScore = 0.62): CatalogueItem[] {
  const queryTokens = normalize(query);
  if (queryTokens.length === 0) return [];
  return items
    .map((item) => ({ item, score: scoreItem(queryTokens, item) }))
    .filter((s) => s.score >= minScore)
    .sort((a, b) => b.score - a.score || a.item.sku.localeCompare(b.item.sku))
    .map((s) => s.item);
}

/**
 * A correction for a query that matched poorly, e.g. "lamb chpos" -> "lamb chops".
 * For each query token with no strong vocabulary match, the nearest vocabulary
 * token above the threshold is offered; null when the query reads well already.
 */
export function didYouMean(query: string, vocabulary: string[], threshold = 0.6): string | null {
  const tokens = normalize(query);
  if (tokens.length === 0) return null;
  const vocab = [...new Set(vocabulary.flatMap((v) => normalize(v)))];
  let changed = false;
  const corrected = tokens.map((token) => {
    let best: string | null = null;
    let bestScore = 0;
    for (const word of vocab) {
      const score = similarity(token, word);
      if (score > bestScore) {
        bestScore = score;
        best = word;
      }
    }
    if (best !== null && bestScore >= threshold && best !== token) {
      changed = true;
      return best;
    }
    return token;
  });
  return changed ? corrected.join(' ') : null;
}
