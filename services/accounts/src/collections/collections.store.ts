import { CollectionActionRecord } from './collections.types';

/** Persistence boundary for collection actions; the SQL adapter lands with the store swap. */
export interface CollectionsStore {
  all(): Promise<CollectionActionRecord[]>;
  get(id: string): Promise<CollectionActionRecord | undefined>;
  insertMany(actions: CollectionActionRecord[]): Promise<CollectionActionRecord[]>;
  replace(action: CollectionActionRecord): Promise<CollectionActionRecord>;
}

/** In-memory store used by tests and local runs until the SQL adapter is wired. */
export class InMemoryCollectionsStore implements CollectionsStore {
  private readonly byId = new Map<string, CollectionActionRecord>();

  constructor(seed: CollectionActionRecord[] = []) {
    for (const action of seed) this.byId.set(action.id, action);
  }

  async all(): Promise<CollectionActionRecord[]> {
    return [...this.byId.values()];
  }

  async get(id: string): Promise<CollectionActionRecord | undefined> {
    return this.byId.get(id);
  }

  async insertMany(actions: CollectionActionRecord[]): Promise<CollectionActionRecord[]> {
    for (const action of actions) this.byId.set(action.id, action);
    return actions;
  }

  async replace(action: CollectionActionRecord): Promise<CollectionActionRecord> {
    this.byId.set(action.id, action);
    return action;
  }
}
