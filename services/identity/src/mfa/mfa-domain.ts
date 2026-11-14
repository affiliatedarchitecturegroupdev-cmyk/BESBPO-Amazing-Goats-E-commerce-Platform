import { generateTotpSecret, otpauthUri, verifyTotp } from './totp';

export const MFA_STORE = 'AG_MFA_STORE';

/** A staff member's second factor. `secret` is stored encrypted at rest. */
export interface MfaEnrolment {
  subjectId: string;
  secret: string;
  enrolledAt?: string;
  /** Set once the first code is confirmed, proving the app is set up. */
  confirmedAt?: string;
}

export interface MfaStore {
  enrolment(subjectId: string): Promise<MfaEnrolment | undefined>;
  save(enrolment: MfaEnrolment): Promise<void>;
}

export class InMemoryMfaStore implements MfaStore {
  private readonly rows = new Map<string, MfaEnrolment>();
  async enrolment(subjectId: string): Promise<MfaEnrolment | undefined> {
    return this.rows.get(subjectId);
  }
  async save(enrolment: MfaEnrolment): Promise<void> {
    this.rows.set(enrolment.subjectId, { ...enrolment });
  }
}

export interface EnrolmentStart {
  secret: string;
  uri: string;
}

export interface EnrolmentResult {
  ok: boolean;
  reason?: string;
}

/** Start enrolment: a fresh secret and the URI to scan. */
export function startEnrolment(subjectId: string, account: string, issuer: string): EnrolmentStart & { subjectId: string } {
  const secret = generateTotpSecret();
  return { subjectId, secret, uri: otpauthUri(secret, account, issuer) };
}

/** Confirm enrolment: the first code must match, then the factor is active. */
export function confirmEnrolment(enrolment: MfaEnrolment, code: string, unixSeconds: number, now: Date): EnrolmentResult {
  if (!verifyTotp(enrolment.secret, code, unixSeconds)) return { ok: false, reason: 'invalid code' };
  enrolment.confirmedAt = now.toISOString();
  return { ok: true };
}

/** Login check: only a confirmed factor can satisfy MFA, and the code must be live. */
export function verifyLogin(enrolment: MfaEnrolment | undefined, code: string, unixSeconds: number): EnrolmentResult {
  if (!enrolment) return { ok: false, reason: 'not enrolled' };
  if (!enrolment.confirmedAt) return { ok: false, reason: 'enrolment not confirmed' };
  if (!verifyTotp(enrolment.secret, code, unixSeconds)) return { ok: false, reason: 'invalid code' };
  return { ok: true };
}
