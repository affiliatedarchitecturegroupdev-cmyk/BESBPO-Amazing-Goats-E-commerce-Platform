import type { CreditTier } from '@ag/shared-types';

/**
 * The trade account application view model. It matches the shape the accounts
 * service accepts (services/accounts/src/credit-applications), so the form submits
 * what the API validates; the helpers keep the wireframe's progress bar, document
 * checklist and credit ladder as pure functions the pages render.
 */

export const BUSINESS_TYPES = [
  { value: 'butchery', label: 'Butchery' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'retail', label: 'Retail store' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'caterer', label: 'Caterer' },
  { value: 'trader', label: 'Trader' },
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number]['value'];

export const REQUIRED_DOCUMENTS = [
  { kind: 'company_registration', label: 'Company registration' },
  { kind: 'vat_certificate', label: 'VAT certificate' },
  { kind: 'certificate_of_acceptability', label: 'Certificate of Acceptability' },
  { kind: 'bank_letter', label: 'Bank letter' },
] as const;
export type DocumentKind = (typeof REQUIRED_DOCUMENTS)[number]['kind'];

export type DocumentState = 'missing' | 'uploaded' | 'verified';

export interface WeeklyVolume {
  item: string;
  qty: number;
}

export interface ApplicationForm {
  businessType: BusinessType | '';
  registrationNumber: string;
  turnoverDeclaredCents: number;
  weeklyVolumes: WeeklyVolume[];
  documents: Record<DocumentKind, DocumentState>;
  requestedLimitCents: number;
  requestedTermsDays: number;
  consentGiven: boolean;
}

export const EMPTY_FORM: ApplicationForm = {
  businessType: '',
  registrationNumber: '',
  turnoverDeclaredCents: 0,
  weeklyVolumes: [
    { item: 'Lamb carcasses', qty: 0 },
    { item: 'Chicken (kg)', qty: 0 },
    { item: 'Egg trays', qty: 0 },
  ],
  documents: {
    company_registration: 'missing',
    vat_certificate: 'missing',
    certificate_of_acceptability: 'missing',
    bank_letter: 'missing',
  },
  requestedLimitCents: 0,
  requestedTermsDays: 0,
  consentGiven: false,
};

export const TOTAL_STEPS = 5;

/** The five application steps the wireframe shows, in order. */
export const STEPS = ['Business', 'Turnover', 'Volumes', 'Documents', 'Credit'] as const;

export interface Progress {
  step: number;
  of: number;
  complete: boolean;
}

/** Which step the applicant is on, and whether the whole form is complete. */
export function applicationProgress(form: ApplicationForm): Progress {
  const business = Boolean(form.businessType && form.registrationNumber.trim());
  const turnover = form.turnoverDeclaredCents > 0;
  const volumes = form.weeklyVolumes.some((v) => v.qty > 0);
  const documents = documentsComplete(form.documents);
  const credit = form.requestedLimitCents > 0 && form.requestedTermsDays > 0 && form.consentGiven;

  let step = 1;
  if (business) step = 2;
  if (business && turnover) step = 3;
  if (business && turnover && volumes) step = 4;
  if (business && turnover && volumes && documents) step = 5;

  return { step, of: TOTAL_STEPS, complete: business && turnover && volumes && documents && credit };
}

/** How far along the progress bar is, as a whole percentage. */
export function progressPct(progress: Progress): number {
  return Math.round((progress.step / progress.of) * 100);
}

/** The document kinds still to upload. */
export function missingDocuments(documents: Record<DocumentKind, DocumentState>): DocumentKind[] {
  return REQUIRED_DOCUMENTS.map((d) => d.kind).filter((kind) => documents[kind] === 'missing');
}

/** The uploaded documents a reviewer has not checked yet. */
export function unverifiedDocuments(documents: Record<DocumentKind, DocumentState>): DocumentKind[] {
  return REQUIRED_DOCUMENTS.map((d) => d.kind).filter((kind) => documents[kind] === 'uploaded');
}

/** Every required document is present and checked. */
export function documentsComplete(documents: Record<DocumentKind, DocumentState>): boolean {
  return missingDocuments(documents).length === 0 && unverifiedDocuments(documents).length === 0;
}

export type TurnoverBand = 'micro' | 'small' | 'medium' | 'large';

const NCA_TURNOVER_THRESHOLD_CENTS = 100_000_000; // R1m
const TURNOVER_SMALL_CENTS = 500_000_000; // R5m
const TURNOVER_MEDIUM_CENTS = 2_500_000_000; // R25m

/** Turnover bands, with the NCA threshold as the first boundary. */
export function turnoverBand(cents: number): TurnoverBand {
  if (cents < NCA_TURNOVER_THRESHOLD_CENTS) return 'micro';
  if (cents < TURNOVER_SMALL_CENTS) return 'small';
  if (cents < TURNOVER_MEDIUM_CENTS) return 'medium';
  return 'large';
}

/** Turnover below R1m may fall inside the National Credit Act, so it needs review. */
export function requiresNcaReview(cents: number): boolean {
  return cents < NCA_TURNOVER_THRESHOLD_CENTS;
}

export interface ValidationResult {
  ok: boolean;
  problems: string[];
}

/** The label for a document kind. */
export function documentLabel(kind: DocumentKind): string {
  return REQUIRED_DOCUMENTS.find((d) => d.kind === kind)?.label ?? kind;
}

/** What is missing before the application can be submitted, in plain language. */
export function validate(form: ApplicationForm): ValidationResult {
  const problems: string[] = [];
  if (!form.businessType) problems.push('Choose a business type');
  if (!form.registrationNumber.trim()) problems.push('Registered name and number are required');
  if (form.turnoverDeclaredCents <= 0) problems.push('Turnover declaration is required');
  for (const kind of missingDocuments(form.documents)) {
    problems.push(`Missing document: ${documentLabel(kind)}`);
  }
  for (const kind of unverifiedDocuments(form.documents)) {
    problems.push(`Document not checked yet: ${documentLabel(kind)}`);
  }
  if (form.requestedLimitCents <= 0) problems.push('Credit requested must be more than zero');
  if (form.requestedTermsDays <= 0) problems.push('Terms must be more than zero days');
  if (!form.consentGiven) problems.push('Directors consent to a credit check is required (POPIA)');
  return { ok: problems.length === 0, problems };
}

export type DocumentTag = { label: string; tone: 'ok' | 'watch' };

/** The status tag for a document row. */
export function documentTag(state: DocumentState): DocumentTag {
  if (state === 'verified') return { label: 'Checked', tone: 'ok' };
  if (state === 'uploaded') return { label: 'Awaiting check', tone: 'watch' };
  return { label: 'Not uploaded', tone: 'watch' };
}

export const TERM_OPTIONS = [7, 14, 30] as const;

/** The next term option above the current one, or the last. */
export function nextTermDays(current: number): number {
  return TERM_OPTIONS.find((t) => t > current) ?? TERM_OPTIONS[TERM_OPTIONS.length - 1];
}

// ---- Credit ladder (wireframe tp-credit) ----

export const TIER_LADDER: CreditTier[] = ['new', 'probation', 'standard', 'preferred'];

const TIER_LABEL: Record<CreditTier, string> = {
  new: 'New',
  probation: 'Probation',
  standard: 'Standard',
  preferred: 'Preferred',
};

/** The ladder position of a tier, from 0 (new) to 3 (preferred). */
export function tierIndex(tier: CreditTier): number {
  return TIER_LADDER.indexOf(tier);
}

export function tierLabel(tier: CreditTier): string {
  return TIER_LABEL[tier];
}

/** The tier above this one, or the same tier when already at the top. */
export function nextTier(tier: CreditTier): CreditTier {
  return TIER_LADDER[Math.min(TIER_LADDER.length - 1, tierIndex(tier) + 1)];
}

/** Clean months needed to reach the next tier, from the credit control design. */
export function monthsToNextTier(tier: CreditTier): number {
  if (tier === 'new') return 3; // 3 prepaid orders
  if (tier === 'probation') return 3; // 3 clean months
  if (tier === 'standard') return 6; // 6 clean months
  return 0;
}

/** How far along the ladder the customer is, as a whole percentage. */
export function ladderPct(tier: CreditTier): number {
  return Math.round((tierIndex(tier) / (TIER_LADDER.length - 1)) * 100);
}

/** The line under the ladder: what earns the next tier. */
export function ladderHint(tier: CreditTier, monthsClean: number): string {
  if (tier === 'preferred') return 'Top tier: 30 day terms';
  const needed = monthsToNextTier(tier);
  const left = Math.max(0, needed - monthsClean);
  return `${left} of ${needed} clean months to ${tierLabel(nextTier(tier))}`;
}

/** LulaPay longer terms are a pilot, offered only when the flag is on. */
export function lulapayOffered(flagOn: boolean): boolean {
  return flagOn;
}

// ---- Dashboard (wireframe tp-dashboard) ----

/** Credit still available, never negative. */
export function creditAvailableCents(limitCents: number, usedCents: number): number {
  return Math.max(0, limitCents - usedCents);
}

/** How much of the limit is used, as a whole percentage, capped at 100. */
export function creditUsagePct(limitCents: number, usedCents: number): number {
  if (limitCents <= 0) return 0;
  return Math.min(100, Math.round((usedCents / limitCents) * 100));
}
