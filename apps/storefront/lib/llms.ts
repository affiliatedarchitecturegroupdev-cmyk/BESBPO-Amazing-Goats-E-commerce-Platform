import { CATEGORIES } from './catalog';
import { OCCASIONS } from './occasions';
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from './seo';

/**
 * `/llms.txt` (T-073): a plain-text summary an assistant can read in one fetch,
 * following the llms.txt convention — a title, a one-line description, then
 * annotated links.
 *
 * It is generated from the same `CATEGORIES` and `OCCASIONS` the shop renders, so
 * a category that exists in the navigation cannot be missing from the summary.
 * Facts that change (prices, stock) are deliberately not listed: a cached copy
 * would go stale, and the pages are the source of truth.
 */
export function buildLlmsTxt(baseUrl?: string): string {
  const base = siteUrl(baseUrl);
  const lines: string[] = [
    `# ${SITE_NAME}`,
    '',
    `> ${SITE_DESCRIPTION}`,
    '',
    'Amazing Goats (Ezimbuzini) is a specialised agricultural division of Besbpo Group. ' +
      'We sell farm-direct lamb, goat, chicken, eggs and dairy in South Africa, priced in ' +
      'rand (ZAR) excluding VAT, ordered against a weekly cut-off and delivered across ' +
      'KwaZulu-Natal on route days.',
    '',
    '## Key pages',
    '',
    `- [Home](${base}/): the shop front, with the current specials and boxes.`,
    `- [Delivery](${base}/delivery): zones, route days, cut-off times and cold-chain handling.`,
    `- [Produce](${base}/produce): the produce range alongside the meat lines.`,
    `- [Recipes](${base}/recipes): how to cook each cut, with the products a recipe uses.`,
    `- [Trade](${base}/trade): wholesale and ceremony supply, including live animals.`,
    `- [About](${base}/about): the farm-direct model and how ordering works.`,
    `- [Contact](${base}/contact): how to reach the team.`,
    '',
    '## Product categories',
    '',
    ...CATEGORIES.map((c) => `- [${c.label}](${base}/shop/${c.slug})`),
    '',
    '## Occasions',
    '',
    ...OCCASIONS.map((o) => `- [${o.label}](${base}/occasions/${o.slug})`),
    '',
    '## Notes for assistants',
    '',
    '- Prices are stored excluding VAT; 15% VAT is added at checkout.',
    '- Orders run on a weekly cycle with a Sunday 17:00 cut-off for the next route day.',
    '- Live animals and ceremony orders are priced on request, not from the catalogue.',
    `- The sitemap is at ${base}/sitemap.xml.`,
    '',
  ];
  return lines.join('\n');
}
