import { randomUUID } from 'node:crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreditApplicationsStore } from './credit-applications.store';
import {
  ApplicationInput,
  CreditApplication,
  addSecondApproval,
  approveApplication,
  rejectApplication,
  submitApplication,
} from './credit-application.rules';

export const CREDIT_APPLICATIONS_STORE = Symbol('CREDIT_APPLICATIONS_STORE');

/**
 * Trade account applications. The service assigns identity and stores; every
 * decision (what is complete, who may approve, when a second approver is needed)
 * lives in the pure rules, so the form and the API agree.
 */
@Injectable()
export class CreditApplicationsService {
  constructor(@Inject(CREDIT_APPLICATIONS_STORE) private readonly store: CreditApplicationsStore) {}

  async list(): Promise<CreditApplication[]> {
    return (await this.store.all()).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }

  async get(id: string): Promise<CreditApplication> {
    const application = await this.store.get(id);
    if (!application) throw new NotFoundException(`unknown application ${id}`);
    return application;
  }

  /** Submit a complete application. An incomplete one is refused by the rule. */
  async submit(input: ApplicationInput, at = new Date().toISOString()): Promise<CreditApplication> {
    return this.store.insert(submitApplication(randomUUID(), input, at));
  }

  /** First approval. A large limit stays submitted until a second person confirms. */
  async approve(id: string, approverUserId: string, at = new Date().toISOString()): Promise<CreditApplication> {
    return this.store.replace(approveApplication(await this.get(id), approverUserId, at));
  }

  /** Second approval for a large limit; the approver must differ from the first. */
  async secondApproval(id: string, approverUserId: string, at = new Date().toISOString()): Promise<CreditApplication> {
    return this.store.replace(addSecondApproval(await this.get(id), approverUserId, at));
  }

  /** Reject an application, with a reason the applicant can be told. */
  async reject(
    id: string,
    approverUserId: string,
    reason: string,
    at = new Date().toISOString(),
  ): Promise<CreditApplication> {
    return this.store.replace(rejectApplication(await this.get(id), approverUserId, reason, at));
  }
}
