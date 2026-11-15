import {
  CREDIT_APPROVAL_THRESHOLD_CENTS,
  NCA_TURNOVER_THRESHOLD_CENTS,
} from '../credit-limits/tiering';

/**
 * A trade account application is the intake: the business declares its turnover
 * and expected volumes, uploads the documents a credit check needs, and consents
 * to the check. The rules here are pure, so the form, the API and the approval
 * all share one definition of "complete" and "who may decide".
 */

export const BUSINESS_TYPES = [
  'butchery',
  'restaurant',
  'retail',
  'bakery',
  'caterer',
  'trader',
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const REQUIRED_DOCUMENTS = [
  { kind: 'company_registration', label: 'Company registration' },
  { kind: 'vat_certificate', label: 'VAT certificate' },
  { kind: 'certificate_of_acceptability', label: 'Certificate of Acceptability' },
  { kind: 'bank_letter', label: 'Bank letter' },
] as const;
export type DocumentKind = (typeof REQUIRED_DOCUMENTS)[number]['kind'];

export interface ApplicationDocument {
  kind: DocumentKind;
  /** Where the upload is stored; the document is the upload, not just a tick. */
  storageUrl: string;
  /** Whether a reviewer has checked the upload against the original. */
  verified: boolean;
  expiresOn?: string;
}

export interface ApplicationInput {
  orgId: string;
  businessType: BusinessType;
  registrationNumber: string;
  turnoverDeclaredCents: number;
  estWeeklySpendCents: number;
  requestedLimitCents: number;
  requestedTermsDays: number;
  documents: ApplicationDocument[];
  /** POPIA: the directors consent to a credit check. */
  consentGiven: boolean;
}

export type ApplicationStatus = 'submitted' | 'approved' | 'rejected';

export interface CreditApplication {
  id: string;
  orgId: string;
  businessType: BusinessType;
  registrationNumber: string;
  turnoverDeclaredCents: number;
  estWeeklySpendCents: number;
  requestedLimitCents: number;
  requestedTermsDays: number;
  documents: ApplicationDocument[];
  consentGiven: boolean;
  status: ApplicationStatus;
  /** True when turnover may put the applicant inside the National Credit Act. */
  ncaReview: boolean;
  submittedAt: string;
  decidedBy?: string;
  secondApprover?: string;
  decidedAt?: string;
  decisionReason?: string;
}

/** Raised when an application is not allowed as asked. */
export class ApplicationRuleError extends Error {}

export type TurnoverBand = 'micro' | 'small' | 'medium' | 'large';

/** Turnover band boundaries, in cents: R5m and R25m. */
export const TURNOVER_SMALL_CENTS = 500_000_000;
export const TURNOVER_MEDIUM_CENTS = 2_500_000_000;

/** Turnover bands. Below R1m (the NCA threshold) the applicant is `micro`. */
export function turnoverBand(cents: number): TurnoverBand {
  if (cents < NCA_TURNOVER_THRESHOLD_CENTS) return 'micro';
  if (cents < TURNOVER_SMALL_CENTS) return 'small';
  if (cents < TURNOVER_MEDIUM_CENTS) return 'medium';
  return 'large';
}

/** Turnover below R1m may fall inside the National Credit Act, so it needs review. */
export function requiresNcaReview(input: Pick<ApplicationInput, 'turnoverDeclaredCents'>): boolean {
  return input.turnoverDeclaredCents < NCA_TURNOVER_THRESHOLD_CENTS;
}

/** The label for a document kind, for a message a person reads. */
export function documentLabel(kind: DocumentKind): string {
  return REQUIRED_DOCUMENTS.find((d) => d.kind === kind)?.label ?? kind;
}

/** The required document kinds that were not uploaded. */
export function missingDocuments(documents: readonly ApplicationDocument[]): DocumentKind[] {
  const have = new Set(documents.map((d) => d.kind));
  return REQUIRED_DOCUMENTS.map((d) => d.kind).filter((kind) => !have.has(kind));
}

/** The uploaded documents a reviewer has not checked yet. */
export function unverifiedDocuments(documents: readonly ApplicationDocument[]): DocumentKind[] {
  return documents.filter((d) => !d.verified).map((d) => d.kind);
}

/** Every required document is present and checked. */
export function documentsComplete(documents: readonly ApplicationDocument[]): boolean {
  return missingDocuments(documents).length === 0 && unverifiedDocuments(documents).length === 0;
}

export interface ValidationResult {
  ok: boolean;
  problems: string[];
}

/** What is missing before the application can be submitted, in plain language. */
export function validateApplication(input: ApplicationInput): ValidationResult {
  const problems: string[] = [];
  if (!input.registrationNumber.trim()) problems.push('Registered name and number are required');
  if (input.turnoverDeclaredCents <= 0) problems.push('Turnover declaration is required');
  if (input.requestedLimitCents <= 0) problems.push('Credit requested must be more than zero');
  if (input.requestedTermsDays <= 0) problems.push('Terms must be more than zero days');
  for (const kind of missingDocuments(input.documents)) {
    problems.push(`Missing document: ${documentLabel(kind)}`);
  }
  for (const kind of unverifiedDocuments(input.documents)) {
    problems.push(`Document not checked yet: ${documentLabel(kind)}`);
  }
  if (!input.consentGiven) problems.push('Directors consent to a credit check is required (POPIA)');
  return { ok: problems.length === 0, problems };
}

export interface ApplicationProgress {
  step: number;
  of: number;
  complete: boolean;
}

/** How many of the five application steps are done, for the progress bar. */
export function applicationProgress(input: Partial<ApplicationInput>): ApplicationProgress {
  const business = Boolean(input.businessType && input.registrationNumber?.trim());
  const turnover = (input.turnoverDeclaredCents ?? 0) > 0;
  const volumes = (input.estWeeklySpendCents ?? 0) > 0;
  const documents = missingDocuments(input.documents ?? []).length === 0;
  const credit =
    (input.requestedLimitCents ?? 0) > 0 &&
    (input.requestedTermsDays ?? 0) > 0 &&
    Boolean(input.consentGiven);

  let step = 1;
  if (business) step = 2;
  if (business && turnover) step = 3;
  if (business && turnover && volumes) step = 4;
  if (business && turnover && volumes && documents) step = 5;

  return { step, of: 5, complete: business && turnover && volumes && documents && credit };
}

/** A limit above the approval threshold needs a second, distinct approver. */
export function needsSecondApproverFor(
  application: Pick<CreditApplication, 'requestedLimitCents'>,
): boolean {
  return application.requestedLimitCents > CREDIT_APPROVAL_THRESHOLD_CENTS;
}

/** Record a complete application as submitted. An incomplete one is rejected. */
export function submitApplication(id: string, input: ApplicationInput, at: string): CreditApplication {
  const { ok, problems } = validateApplication(input);
  if (!ok) throw new ApplicationRuleError(`application is incomplete: ${problems.join('; ')}`);
  return {
    id,
    orgId: input.orgId,
    businessType: input.businessType,
    registrationNumber: input.registrationNumber,
    turnoverDeclaredCents: input.turnoverDeclaredCents,
    estWeeklySpendCents: input.estWeeklySpendCents,
    requestedLimitCents: input.requestedLimitCents,
    requestedTermsDays: input.requestedTermsDays,
    documents: input.documents,
    consentGiven: input.consentGiven,
    status: 'submitted',
    ncaReview: requiresNcaReview(input),
    submittedAt: at,
  };
}

/**
 * First approval. A limit above the threshold stays `submitted` until a second,
 * distinct person confirms; at or below it a single approver is enough. An
 * approver must be named, and a submitted application is the only one that can
 * be decided.
 */
export function approveApplication(
  application: CreditApplication,
  approverUserId: string,
  at: string,
): CreditApplication {
  if (application.status !== 'submitted') {
    throw new ApplicationRuleError(`only a submitted application can be approved, this one is ${application.status}`);
  }
  if (!approverUserId) throw new ApplicationRuleError('an approver must be named');
  const decided: CreditApplication = { ...application, decidedBy: approverUserId };
  if (needsSecondApproverFor(application)) return decided;
  return { ...decided, status: 'approved', decidedAt: at };
}

/** Second approval for a large limit; the approver must differ from the first. */
export function addSecondApproval(
  application: CreditApplication,
  approverUserId: string,
  at: string,
): CreditApplication {
  if (application.status !== 'submitted' || !application.decidedBy) {
    throw new ApplicationRuleError('the first approval must be recorded before the second');
  }
  if (!approverUserId) throw new ApplicationRuleError('an approver must be named');
  if (approverUserId === application.decidedBy) {
    throw new ApplicationRuleError('the second approver must differ from the first');
  }
  return { ...application, secondApprover: approverUserId, status: 'approved', decidedAt: at };
}

/** Reject an application, with a reason the applicant can be told. */
export function rejectApplication(
  application: CreditApplication,
  approverUserId: string,
  reason: string,
  at: string,
): CreditApplication {
  if (application.status !== 'submitted') {
    throw new ApplicationRuleError(`only a submitted application can be rejected, this one is ${application.status}`);
  }
  if (!approverUserId) throw new ApplicationRuleError('an approver must be named');
  if (!reason.trim()) throw new ApplicationRuleError('a rejection needs a reason');
  return {
    ...application,
    decidedBy: approverUserId,
    status: 'rejected',
    decisionReason: reason,
    decidedAt: at,
  };
}
