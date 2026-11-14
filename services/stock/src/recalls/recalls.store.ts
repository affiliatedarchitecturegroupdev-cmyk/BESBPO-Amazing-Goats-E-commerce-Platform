import { Recall } from './recalls.domain';

/** Persistence boundary for recalls; the SQL adapter lands with the stock store swap. */
export interface RecallStore {
  list(): Promise<Recall[]>;
  get(id: string): Promise<Recall | undefined>;
  insert(recall: Recall): Promise<Recall>;
  close(id: string, closedAt: string): Promise<void>;
}

/** In-memory recall store used by tests and local runs until the SQL adapter is wired. */
export class InMemoryRecallStore implements RecallStore {
  private readonly byId = new Map<string, Recall>();

  constructor(seed: Recall[] = []) {
    for (const recall of seed) this.byId.set(recall.id, recall);
  }

  async list(): Promise<Recall[]> {
    return [...this.byId.values()];
  }

  async get(id: string): Promise<Recall | undefined> {
    return this.byId.get(id);
  }

  async insert(recall: Recall): Promise<Recall> {
    this.byId.set(recall.id, recall);
    return recall;
  }

  async close(id: string, closedAt: string): Promise<void> {
    const recall = this.byId.get(id);
    if (recall) this.byId.set(id, { ...recall, closedAt });
  }
}
