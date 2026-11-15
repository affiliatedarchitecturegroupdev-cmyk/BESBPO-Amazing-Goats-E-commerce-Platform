import { describe, it, expect } from 'vitest';
import {
  ApplicationDocument,
  ApplicationInput,
  ApplicationRuleError,
  addSecondApproval,
  applicationProgress,
  approveApplication,
  documentsComplete,
  missingDocuments,
  needsSecondApproverFor,
  rejectApplication,
  requiresNcaReview,
  submitApplication,
  turnoverBand,
  unverifiedDocuments,
  validateApplication,
} from './credit-application.rules';

const docs = (verified = true): ApplicationDocument[] =>
  [
    'company_registration',
    'vat_certificate',
    'certificate_of_acceptability',
    'bank_letter',
  ].map((kind) => ({ kind, storageUrl: `https://files/${kind}.pdf`, verified })) as ApplicationDocument[];

const input = (overrides: Partial<ApplicationInput> = {}): ApplicationInput => ({
  orgId: 'org-1',
  businessType: 'butchery',
  registrationNumber: '2019/123456/07',
  turnoverDeclaredCents: 1_500_000_000, // R15m
  estWeeklySpendCents: 500_000,
  requestedLimitCents: 5_000_000, // R50,000, below the approval threshold
  requestedTermsDays: 14,
  documents: docs(),
  consentGiven: true,
  ...overrides,
});

describe('turnoverBand', () => {
  it('bands turnover around the NCA and size boundaries', () => {
    expect(turnoverBand(90_000_000)).toBe('micro'); // R900k, below the NCA R1m
    expect(turnoverBand(100_000_000)).toBe('small'); // exactly R1m
    expect(turnoverBand(499_999_999)).toBe('small'); // just below R5m
    expect(turnoverBand(500_000_000)).toBe('medium'); // exactly R5m
    expect(turnoverBand(2_500_000_000)).toBe('large'); // exactly R25m
  });
});

describe('requiresNcaReview', () => {
  it('flags turnover below the R1m NCA threshold', () => {
    expect(requiresNcaReview({ turnoverDeclaredCents: 99_999_999 })).toBe(true);
    expect(requiresNcaReview({ turnoverDeclaredCents: 100_000_000 })).toBe(false);
  });
});

describe('document checks', () => {
  it('reports missing required documents', () => {
    expect(missingDocuments([docs()[0]])).toEqual([
      'vat_certificate',
      'certificate_of_acceptability',
      'bank_letter',
    ]);
  });

  it('reports uploaded but unchecked documents', () => {
    expect(unverifiedDocuments(docs(false))).toHaveLength(4);
    expect(unverifiedDocuments(docs(true))).toEqual([]);
  });

  it('is complete only when every document is present and checked', () => {
    expect(documentsComplete(docs(true))).toBe(true);
    expect(documentsComplete(docs(false))).toBe(false);
    expect(documentsComplete([docs()[0]])).toBe(false);
  });
});

describe('validateApplication', () => {
  it('accepts a complete application', () => {
    expect(validateApplication(input()).ok).toBe(true);
  });

  it('names each missing piece', () => {
    const { ok, problems } = validateApplication(
      input({ registrationNumber: '', turnoverDeclaredCents: 0, documents: [], consentGiven: false }),
    );
    expect(ok).toBe(false);
    expect(problems).toEqual(
      expect.arrayContaining([
        'Registered name and number are required',
        'Turnover declaration is required',
        'Missing document: Company registration',
        'Directors consent to a credit check is required (POPIA)',
      ]),
    );
  });
});

describe('applicationProgress', () => {
  it('walks the five steps', () => {
    expect(applicationProgress({}).step).toBe(1);
    expect(applicationProgress({ businessType: 'bakery', registrationNumber: '1' }).step).toBe(2);
    expect(applicationProgress(input()).step).toBe(5);
    expect(applicationProgress(input()).complete).toBe(true);
    expect(applicationProgress(input({ consentGiven: false })).complete).toBe(false);
  });
});

describe('submitApplication', () => {
  it('records a complete application as submitted with the NCA flag', () => {
    const app = submitApplication('app-1', input(), '2026-01-01T00:00:00.000Z');
    expect(app.status).toBe('submitted');
    expect(app.ncaReview).toBe(false);
    expect(app.submittedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('refuses an incomplete application', () => {
    expect(() => submitApplication('app-1', input({ consentGiven: false }), 'now')).toThrow(ApplicationRuleError);
  });
});

describe('approval workflow (four eyes)', () => {
  it('approves a small limit with one approver', () => {
    const app = submitApplication('app-1', input(), '2026-01-01T00:00:00.000Z');
    expect(needsSecondApproverFor(app)).toBe(false);
    const approved = approveApplication(app, 'user-1', '2026-01-02T00:00:00.000Z');
    expect(approved.status).toBe('approved');
    expect(approved.decidedBy).toBe('user-1');
  });

  it('keeps a large limit submitted until a second, distinct approver confirms', () => {
    const app = submitApplication('app-1', input({ requestedLimitCents: 20_000_000 }), 'now'); // R200,000
    expect(needsSecondApproverFor(app)).toBe(true);

    const first = approveApplication(app, 'user-1', 'now');
    expect(first.status).toBe('submitted');
    expect(first.decidedBy).toBe('user-1');

    expect(() => addSecondApproval(first, 'user-1', 'now')).toThrow(/must differ/);
    const second = addSecondApproval(first, 'user-2', 'now');
    expect(second.status).toBe('approved');
    expect(second.secondApprover).toBe('user-2');
  });

  it('will not approve twice or without an approver', () => {
    const app = submitApplication('app-1', input(), 'now');
    const approved = approveApplication(app, 'user-1', 'now');
    expect(() => approveApplication(approved, 'user-2', 'now')).toThrow(/only a submitted application/);
    expect(() => approveApplication(app, '', 'now')).toThrow(/approver must be named/);
  });

  it('rejects with a reason', () => {
    const app = submitApplication('app-1', input(), 'now');
    const rejected = rejectApplication(app, 'user-1', 'bureau risk', 'now');
    expect(rejected.status).toBe('rejected');
    expect(rejected.decisionReason).toBe('bureau risk');
    expect(() => rejectApplication(app, 'user-1', '  ', 'now')).toThrow(/needs a reason/);
  });
});
