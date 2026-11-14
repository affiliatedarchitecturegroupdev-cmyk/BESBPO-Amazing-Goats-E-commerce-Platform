import { BadRequestException, Inject, Injectable, Optional } from '@nestjs/common';
import {
  MFA_STORE,
  MfaStore,
  InMemoryMfaStore,
  startEnrolment,
  confirmEnrolment,
  verifyLogin,
} from './mfa-domain';

/** Injection token for the clock, so tests can freeze time. */
export const MFA_CLOCK = 'AG_MFA_CLOCK';
/** Injection token for the issuer name shown in authenticator apps. */
export const MFA_ISSUER = 'AG_MFA_ISSUER';

export interface LoginResult {
  ok: boolean;
  reason?: string;
}

@Injectable()
export class MfaService {
  constructor(
    @Optional() @Inject(MFA_STORE) private readonly store: MfaStore = new InMemoryMfaStore(),
    @Optional() @Inject(MFA_CLOCK) private readonly now: () => Date = () => new Date(),
    @Optional() @Inject(MFA_ISSUER) private readonly issuer = 'Amazing Goats',
  ) {}

  /** Begin enrolment for a subject; returns the secret and the URI to scan. */
  async beginEnrolment(subjectId: string, account: string): Promise<{ secret: string; uri: string }> {
    const started = startEnrolment(subjectId, account, this.issuer);
    await this.store.save({ subjectId, secret: started.secret });
    return { secret: started.secret, uri: started.uri };
  }

  /** Confirm enrolment with the first code from the authenticator app. */
  async confirm(subjectId: string, code: string): Promise<void> {
    const enrolment = await this.store.enrolment(subjectId);
    if (!enrolment) throw new BadRequestException('not enrolled');
    const result = confirmEnrolment(enrolment, code, this.unixSeconds(), this.now());
    if (!result.ok) throw new BadRequestException(result.reason);
    await this.store.save(enrolment);
  }

  /** Verify a login code against the stored, confirmed factor. */
  async verify(subjectId: string, code: string): Promise<LoginResult> {
    const enrolment = await this.store.enrolment(subjectId);
    const result = verifyLogin(enrolment, code, this.unixSeconds());
    return result.ok ? { ok: true } : { ok: false, reason: result.reason };
  }

  /** Whether a subject has a confirmed second factor. */
  async isEnrolled(subjectId: string): Promise<boolean> {
    return !!(await this.store.enrolment(subjectId))?.confirmedAt;
  }

  private unixSeconds(): number {
    return Math.floor(this.now().getTime() / 1000);
  }
}
