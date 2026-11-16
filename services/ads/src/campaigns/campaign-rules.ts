/**
 * Retail-media campaign rules (docs/06-ads.md). Everything a campaign or a
 * creative must satisfy before it can go live is a pure function here, so the
 * advertiser portal, the API and the review queue share one definition of
 * "complete", "reviewed" and "may run".
 */

export const PRICING = ['flat', 'cpc', 'cpm'] as const;
export type Pricing = (typeof PRICING)[number];

export type CampaignStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'live'
  | 'paused'
  | 'ended'
  | 'rejected';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

/** The seeded slots (A1 to A12); a creative must target one of these. */
export const SLOT_CODES = [
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11', 'A12',
] as const;
export type SlotCode = (typeof SLOT_CODES)[number];

export interface Targeting {
  category?: string;
  region?: string;
  buyerType?: string;
}

export interface CampaignInput {
  advertiserOrgId: string;
  name: string;
  goal: string;
  budgetCents: number;
  pricing: Pricing;
  /** Required for a CPC or CPM campaign; a flat campaign has no bid. */
  bidCents?: number;
  startsAt?: string;
  endsAt?: string;
  targeting?: Targeting;
}

export interface Campaign {
  id: string;
  advertiserOrgId: string;
  name: string;
  goal: string;
  budgetCents: number;
  spentCents: number;
  pricing: Pricing;
  bidCents?: number;
  startsAt?: string;
  endsAt?: string;
  status: CampaignStatus;
  targeting: Targeting;
  submittedAt?: string;
  reviewedBy?: string;
  decidedAt?: string;
  decisionReason?: string;
}

export interface CreativeInput {
  campaignId: string;
  slotCode: SlotCode;
  assetUrl: string;
  headline?: string;
  destinationUrl?: string;
  /** Where the proof for any claim in the headline is stored. */
  claimsEvidenceUrl?: string;
}

export interface Creative {
  id: string;
  campaignId: string;
  slotCode: SlotCode;
  assetUrl: string;
  headline?: string;
  destinationUrl?: string;
  claimsEvidenceUrl?: string;
  reviewStatus: ReviewStatus;
  reviewedBy?: string;
  reviewNotes?: string;
  reviewedAt?: string;
}

/** Raised when an action is not allowed in the current state. */
export class AdRuleError extends Error {}

export interface ValidationResult {
  ok: boolean;
  problems: string[];
}

/**
 * Claim language that needs written evidence before a creative may be approved.
 * Grounded in docs/07-compliance.md: health, nutritional, halaal, organic,
 * free-range, grading and superlative claims all carry proof obligations.
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

function words(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9#]+/).filter(Boolean);
}

/** The claim keywords present in a headline, if any. */
export function claimsIn(headline: string | undefined): string[] {
  if (!headline) return [];
  const lower = headline.toLowerCase();
  const tokens = new Set(words(headline));
  return CLAIM_KEYWORDS.filter((k) =>
    k.includes(' ') || k.includes('#') || k.includes('-') || k.includes('.')
      ? lower.includes(k)
      : tokens.has(k),
  );
}

/** A health or medical claim, which may never be approved (R146 of 2010). */
export function hasHealthClaim(headline: string | undefined): boolean {
  return claimsIn(headline).some((k) => (HEALTH_CLAIM_KEYWORDS as readonly string[]).includes(k));
}

/** A creative that makes any claim must point at its evidence. */
export function requiresClaimsEvidence(creative: Pick<CreativeInput, 'headline'>): boolean {
  return claimsIn(creative.headline).length > 0;
}

function isoAfter(earlier: string, later: string): boolean {
  return Date.parse(later) > Date.parse(earlier);
}

/** What is wrong with a campaign before it can be submitted, in plain language. */
export function validateCampaign(input: CampaignInput): ValidationResult {
  const problems: string[] = [];
  if (!input.name.trim()) problems.push('A campaign name is required');
  if (!input.goal.trim()) problems.push('A campaign goal is required');
  if (input.budgetCents <= 0) problems.push('Budget must be more than zero');
  if (!PRICING.includes(input.pricing)) problems.push(`Pricing must be one of ${PRICING.join(', ')}`);
  if (input.pricing !== 'flat' && !(input.bidCents && input.bidCents > 0)) {
    problems.push(`A ${input.pricing.toUpperCase()} campaign needs a bid`);
  }
  if (input.startsAt && input.endsAt && !isoAfter(input.startsAt, input.endsAt)) {
    problems.push('The end date must be after the start date');
  }
  return { ok: problems.length === 0, problems };
}

/** What is wrong with a creative before it can be reviewed, in plain language. */
export function validateCreative(input: CreativeInput): ValidationResult {
  const problems: string[] = [];
  if (!input.assetUrl.trim()) problems.push('A creative asset is required');
  if (!(SLOT_CODES as readonly string[]).includes(input.slotCode)) {
    problems.push(`Slot must be one of ${SLOT_CODES.join(', ')}`);
  }
  if (hasHealthClaim(input.headline)) {
    problems.push('No health or medical claims are allowed (R146)');
  }
  if (requiresClaimsEvidence(input) && !input.claimsEvidenceUrl?.trim()) {
    const claims = claimsIn(input.headline).join(', ');
    problems.push(`Claims evidence is required for: ${claims}`);
  }
  return { ok: problems.length === 0, problems };
}

/** A new campaign starts as a draft, with nothing spent. */
export function draftCampaign(id: string, input: CampaignInput): Campaign {
  const { ok, problems } = validateCampaign(input);
  if (!ok) throw new AdRuleError(`campaign is invalid: ${problems.join('; ')}`);
  return {
    id,
    advertiserOrgId: input.advertiserOrgId,
    name: input.name,
    goal: input.goal,
    budgetCents: input.budgetCents,
    spentCents: 0,
    pricing: input.pricing,
    bidCents: input.bidCents,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    status: 'draft',
    targeting: input.targeting ?? {},
  };
}

/** Submit a draft for human review. A campaign needs at least one creative. */
export function submitForReview(campaign: Campaign, creativeCount: number, at: string): Campaign {
  if (campaign.status !== 'draft') {
    throw new AdRuleError(`only a draft can be submitted, this one is ${campaign.status}`);
  }
  if (creativeCount < 1) throw new AdRuleError('a campaign needs at least one creative');
  return { ...campaign, status: 'pending_review', submittedAt: at };
}

/** A named human approves a campaign. Nothing goes live without this step. */
export function approveCampaign(campaign: Campaign, reviewerUserId: string, at: string): Campaign {
  if (campaign.status !== 'pending_review') {
    throw new AdRuleError(`only a campaign in review can be approved, this one is ${campaign.status}`);
  }
  if (!reviewerUserId) throw new AdRuleError('a reviewer must be named');
  return { ...campaign, status: 'approved', reviewedBy: reviewerUserId, decidedAt: at };
}

/** Reject a campaign in review, with a reason the advertiser can act on. */
export function rejectCampaign(
  campaign: Campaign,
  reviewerUserId: string,
  reason: string,
  at: string,
): Campaign {
  if (campaign.status !== 'pending_review') {
    throw new AdRuleError(`only a campaign in review can be rejected, this one is ${campaign.status}`);
  }
  if (!reviewerUserId) throw new AdRuleError('a reviewer must be named');
  if (!reason.trim()) throw new AdRuleError('a rejection needs a reason');
  return { ...campaign, status: 'rejected', reviewedBy: reviewerUserId, decisionReason: reason, decidedAt: at };
}

/** A new creative starts pending review, whatever the advertiser submitted. */
export function draftCreative(id: string, input: CreativeInput): Creative {
  const { ok, problems } = validateCreative(input);
  if (!ok) throw new AdRuleError(`creative is invalid: ${problems.join('; ')}`);
  return {
    id,
    campaignId: input.campaignId,
    slotCode: input.slotCode,
    assetUrl: input.assetUrl,
    headline: input.headline,
    destinationUrl: input.destinationUrl,
    claimsEvidenceUrl: input.claimsEvidenceUrl,
    reviewStatus: 'pending',
  };
}

/**
 * A human approves or rejects a pending creative. Approval is refused while a
 * health claim is present, or while a claim has no evidence on file. A rejection
 * must carry a reason.
 */
export function reviewCreative(
  creative: Creative,
  reviewerUserId: string,
  decision: 'approved' | 'rejected',
  at: string,
  notes?: string,
): Creative {
  if (creative.reviewStatus !== 'pending') {
    throw new AdRuleError(`only a creative pending review can be decided, this one is ${creative.reviewStatus}`);
  }
  if (!reviewerUserId) throw new AdRuleError('a reviewer must be named');
  if (decision === 'approved') {
    if (hasHealthClaim(creative.headline)) {
      throw new AdRuleError('a creative with a health or medical claim cannot be approved');
    }
    if (requiresClaimsEvidence(creative) && !creative.claimsEvidenceUrl?.trim()) {
      throw new AdRuleError('a creative with a claim needs evidence before it can be approved');
    }
  }
  if (decision === 'rejected' && !notes?.trim()) {
    throw new AdRuleError('a rejection needs a reason');
  }
  return { ...creative, reviewStatus: decision, reviewedBy: reviewerUserId, reviewNotes: notes, reviewedAt: at };
}

export interface GoLiveCheck {
  ok: boolean;
  problems: string[];
}

/**
 * Why a campaign may not run yet. Approval is not enough on its own: every
 * creative must be approved, there must be at least one, and there must be
 * budget left. This is the single gate the decisioning service also reads.
 */
export function canGoLive(campaign: Campaign, creatives: readonly Creative[]): GoLiveCheck {
  const problems: string[] = [];
  if (campaign.status !== 'approved' && campaign.status !== 'paused') {
    problems.push(`campaign must be approved before it can run, it is ${campaign.status}`);
  }
  if (creatives.length === 0) problems.push('campaign has no creatives');
  for (const creative of creatives) {
    if (creative.reviewStatus !== 'approved') {
      problems.push(`creative ${creative.id} is ${creative.reviewStatus}`);
    }
  }
  if (campaign.spentCents >= campaign.budgetCents) problems.push('campaign budget is exhausted');
  return { ok: problems.length === 0, problems };
}

/** Take an approved campaign live, once every gate passes. */
export function goLive(campaign: Campaign, creatives: readonly Creative[], at: string): Campaign {
  const { ok, problems } = canGoLive(campaign, creatives);
  if (!ok) throw new AdRuleError(`campaign cannot go live: ${problems.join('; ')}`);
  return { ...campaign, status: 'live', decidedAt: campaign.decidedAt ?? at };
}

/** Pause a live campaign without losing its approval. */
export function pauseCampaign(campaign: Campaign): Campaign {
  if (campaign.status !== 'live') {
    throw new AdRuleError(`only a live campaign can be paused, this one is ${campaign.status}`);
  }
  return { ...campaign, status: 'paused' };
}

/** End a campaign; a live or paused campaign can be ended. */
export function endCampaign(campaign: Campaign, at: string): Campaign {
  if (campaign.status !== 'live' && campaign.status !== 'paused') {
    throw new AdRuleError(`only a live or paused campaign can be ended, this one is ${campaign.status}`);
  }
  return { ...campaign, status: 'ended', decidedAt: at };
}
