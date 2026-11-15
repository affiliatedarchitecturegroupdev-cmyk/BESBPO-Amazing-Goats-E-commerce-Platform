import { CreditApplication } from './credit-application.rules';

/**
 * Persistence boundary for trade account applications. The SQL adapter lands with
 * the store swap; the in-memory store is the default so tests and local runs need
 * no database.
 */
export interface CreditApplicationsStore {
  all(): Promise<CreditApplication[]>;
  get(id: string): Promise<CreditApplication | undefined>;
  insert(application: CreditApplication): Promise<CreditApplication>;
  replace(application: CreditApplication): Promise<CreditApplication>;
}

/** In-memory store keyed by application id. */
export class InMemoryCreditApplicationsStore implements CreditApplicationsStore {
  private readonly byId = new Map<string, CreditApplication>();

  constructor(seed: CreditApplication[] = []) {
    for (const application of seed) this.byId.set(application.id, application);
  }

  async all(): Promise<CreditApplication[]> {
    return [...this.byId.values()];
  }

  async get(id: string): Promise<CreditApplication | undefined> {
    return this.byId.get(id);
  }

  async insert(application: CreditApplication): Promise<CreditApplication> {
    this.byId.set(application.id, application);
    return application;
  }

  async replace(application: CreditApplication): Promise<CreditApplication> {
    if (!this.byId.has(application.id)) throw new Error(`application ${application.id} not found`);
    this.byId.set(application.id, application);
    return application;
  }
}
