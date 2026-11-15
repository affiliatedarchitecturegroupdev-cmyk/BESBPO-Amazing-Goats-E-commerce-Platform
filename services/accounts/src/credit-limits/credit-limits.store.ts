import { CreditProposal } from './credit-approval.rules';

/**
 * Persistence boundary for credit limits. The SQL adapter lands with the store
 * swap; the in-memory store is the default so tests and local runs need no
 * database.
 */
export interface CreditLimitsStore {
  all(): Promise<CreditProposal[]>;
  get(orgId: string): Promise<CreditProposal | undefined>;
  upsert(proposal: CreditProposal): Promise<CreditProposal>;
}

/** In-memory store keyed by org, holding the latest proposal per org. */
export class InMemoryCreditLimitsStore implements CreditLimitsStore {
  private readonly byOrg = new Map<string, CreditProposal>();

  constructor(seed: CreditProposal[] = []) {
    for (const proposal of seed) this.byOrg.set(proposal.orgId, proposal);
  }

  async all(): Promise<CreditProposal[]> {
    return [...this.byOrg.values()];
  }

  async get(orgId: string): Promise<CreditProposal | undefined> {
    return this.byOrg.get(orgId);
  }

  async upsert(proposal: CreditProposal): Promise<CreditProposal> {
    this.byOrg.set(proposal.orgId, proposal);
    return proposal;
  }
}
