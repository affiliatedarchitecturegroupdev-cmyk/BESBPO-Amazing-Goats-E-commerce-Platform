/**
 * The advertiser portal view model. It matches the shape the ads service
 * accepts (services/ads/src/campaigns/campaign-rules), so the builder submits
 * what the API validates; the helpers keep the wireframe's slot picker, pricing
 * table, claim warning and review tags as pure functions the pages render.
 */

export const PRICING = [
  { value: 'flat', label: 'Flat', hint: 'Fixed price for a premium slot' },
  { value: 'cpc', label: 'CPC', hint: 'Cost per click, for product tiles' },
  { value: 'cpm', label: 'CPM', hint: 'Cost per thousand views, for banners' },
] as const;
export type Pricing = (typeof PRICING)[number]['value'];

/** The seeded slots (A1 to A12), as the campaign builder offers them. */
export const SLOTS = [
  { code: 'A1', label: 'Home hero' },
  { code: 'A2', label: 'Home mid band' },
  { code: 'A3', label: 'Category top' },
  { code: 'A4', label: 'Sponsored grid tile' },
  { code: 'A5', label: 'Search top' },
  { code: 'A6', label: 'Product page' },
  { code: 'A7', label: 'Cart cross-sell' },
  { code: 'A8', label: 'Order confirmation' },
  { code: 'A9', label: 'Recipes' },
  { code: 'A10', label: 'Footer partners' },
  { code: 'A11', label: 'Email and WhatsApp' },
  { code: 'A12', label: 'Box insert' },
] as const;
export type SlotCode = (typeof SLOTS)[number]['code'];

export interface Targeting {
  category: string;
  region: string;
  buyerType: string;
}

export const BUYER_TYPES = ['Household', 'Trade', 'Both'] as const;

export interface CampaignForm {
  goal: string;
  budgetCents: number;
  pricing: Pricing;
  bidCents: number;
  slotCode: SlotCode | '';
  targeting: Targeting;
  headline: string;
  destinationUrl: string;
  claimsEvidenceUrl: string;
}

export const EMPTY_FORM: CampaignForm = {
  goal: '',
  budgetCents: 0,
  pricing: 'flat',
  bidCents: 0,
  slotCode: '',
  targeting: { category: '', region: '', buyerType: 'Household' },
  headline: '',
  destinationUrl: '',
  claimsEvidenceUrl: '',
};

/**
 * Claim language that needs written evidence before a creative may be approved.
 * Mirrors the ads service list; kept here so the builder can warn before submit.
 */
export const CLAIM_KEYWORDS = [
  'cures', 'cure', 'prevents', 'prevent', 'treats', 'treat', 'heals', 'heal',
  'medicinal', 'therapeutic', 'boosts immunity', 'detox',
  'high in', 'source of', 'low fat', 'fat free', 'cholesterol',
  'halaal', 'halal', 'organic', 'free-range', 'free range', 'grass-fed',
  'grass fed', 'a-grade', 'a grade', 'grade a', 'best', 'number 1', 'no.1', '#1',
] as const;

/** The subset of claims that are banned outright, whatever the evidence. */
export const HEALTH_CLAIM_KEYWORDS = [
  'cures', 'cure', 'prevents', 'prevent', 'treats', 'treat', 'heals', 'heal',
  'medicinal', 'therapeutic', 'boosts immunity', 'detox',
] as const;

function tokens(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/[^a-z0-9#]+/).filter(Boolean));
}

/** The claim keywords present in a headline. */
export function claimsIn(headline: string): string[] {
  if (!headline) return [];
  const lower = headline.toLowerCase();
  const words = tokens(headline);
  return CLAIM_KEYWORDS.filter((k) =>
    k.includes(' ') || k.includes('#') || k.includes('-') || k.includes('.') ? lower.includes(k) : words.has(k),
  );
}

/** A health or medical claim, which may never be approved (R146 of 2010). */
export function hasHealthClaim(headline: string): boolean {
  return claimsIn(headline).some((k) => (HEALTH_CLAIM_KEYWORDS as readonly string[]).includes(k));
}

/** A creative that makes any claim must point at its evidence. */
export function requiresClaimsEvidence(headline: string): boolean {
  return claimsIn(headline).length > 0;
}

export interface ValidationResult {
  ok: boolean;
  problems: string[];
}

/** What is missing before the campaign can be submitted, in plain language. */
export function validate(form: CampaignForm): ValidationResult {
  const problems: string[] = [];
  if (!form.goal.trim()) problems.push('A campaign goal is required');
  if (form.budgetCents <= 0) problems.push('Budget must be more than zero');
  if (form.pricing !== 'flat' && form.bidCents <= 0) {
    problems.push(`A ${form.pricing.toUpperCase()} campaign needs a bid`);
  }
  if (!form.slotCode) problems.push('Choose a slot (A1 to A12)');
  if (!form.headline.trim()) problems.push('A creative headline is required');
  if (hasHealthClaim(form.headline)) problems.push('No health or medical claims are allowed (R146)');
  if (requiresClaimsEvidence(form.headline) && !form.claimsEvidenceUrl.trim()) {
    problems.push(`Claims evidence is required for: ${claimsIn(form.headline).join(', ')}`);
  }
  return { ok: problems.length === 0, problems };
}

/** How many of the builder's four steps are done, for the progress bar. */
export function builderProgress(form: CampaignForm): { step: number; of: number; complete: boolean } {
  const of = 4;
  const goal = Boolean(form.goal.trim() && form.budgetCents > 0);
  const slot = Boolean(form.slotCode && form.pricing);
  const creative = Boolean(form.headline.trim());
  const claims = creative && (!requiresClaimsEvidence(form.headline) || Boolean(form.claimsEvidenceUrl.trim()));
  let step = 1;
  if (goal) step = 2;
  if (goal && slot) step = 3;
  if (goal && slot && creative) step = 4;
  return { step, of, complete: goal && slot && claims };
}

/** The label for a slot code, for a message a person reads. */
export function slotLabel(code: SlotCode | ''): string {
  return SLOTS.find((s) => s.code === code)?.label ?? 'No slot';
}

export type ReviewTag = { label: string; tone: 'ok' | 'watch' | 'info' };

/** The status tag for a creative's review state. */
export function reviewTag(status: 'pending' | 'approved' | 'rejected'): ReviewTag {
  if (status === 'approved') return { label: 'Approved', tone: 'ok' };
  if (status === 'rejected') return { label: 'Rejected', tone: 'watch' };
  return { label: 'In review', tone: 'info' };
}

/** The status tag for a campaign's lifecycle state. */
export function campaignTag(status: string): ReviewTag {
  if (status === 'live') return { label: 'Live', tone: 'ok' };
  if (status === 'approved') return { label: 'Approved', tone: 'ok' };
  if (status === 'rejected') return { label: 'Rejected', tone: 'watch' };
  if (status === 'pending_review') return { label: 'In review', tone: 'info' };
  if (status === 'paused') return { label: 'Paused', tone: 'info' };
  return { label: 'Draft', tone: 'info' };
}

/** Budget left, never negative. */
export function budgetRemainingCents(budgetCents: number, spentCents: number): number {
  return Math.max(0, budgetCents - spentCents);
}

/** How much of the budget is spent, as a whole percentage, capped at 100. */
export function spendPct(budgetCents: number, spentCents: number): number {
  if (budgetCents <= 0) return 0;
  return Math.min(100, Math.round((spentCents / budgetCents) * 100));
}
