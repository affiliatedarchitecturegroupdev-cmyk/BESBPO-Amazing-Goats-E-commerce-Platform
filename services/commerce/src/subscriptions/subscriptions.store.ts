import { StandingOrder, Subscription } from './subscriptions.types';

/** Persistence boundary for subscriptions and standing orders; the SQL adapter lands with the store swap. */
export interface SubscriptionStore {
  subscriptions(): Promise<Subscription[]>;
  /**
   * The subscriptions a customer owns. The filter is part of the store contract
   * rather than a `filter` in the caller, so the in-memory store (which has no
   * RLS) and the SQL store (which has) behave the same, and the ownership rule
   * holds even for a caller that reads without a session.
   */
  listByCustomer(userId: string): Promise<Subscription[]>;
  getSubscription(id: string): Promise<Subscription | undefined>;
  saveSubscription(subscription: Subscription): Promise<Subscription>;

  standingOrders(): Promise<StandingOrder[]>;
  getStandingOrder(id: string): Promise<StandingOrder | undefined>;
  saveStandingOrder(standingOrder: StandingOrder): Promise<StandingOrder>;
}

/** In-memory store used by tests and local runs until the SQL adapter is wired. */
export class InMemorySubscriptionStore implements SubscriptionStore {
  private readonly subs = new Map<string, Subscription>();
  private readonly standing = new Map<string, StandingOrder>();

  constructor(subs: Subscription[] = [], standing: StandingOrder[] = []) {
    for (const s of subs) this.subs.set(s.id, s);
    for (const s of standing) this.standing.set(s.id, s);
  }

  async subscriptions(): Promise<Subscription[]> {
    return [...this.subs.values()];
  }

  async listByCustomer(userId: string): Promise<Subscription[]> {
    return [...this.subs.values()]
      .filter((s) => s.customerUserId === userId)
      .sort((a, b) => a.nextRunAt.localeCompare(b.nextRunAt));
  }

  async getSubscription(id: string): Promise<Subscription | undefined> {
    return this.subs.get(id);
  }

  async saveSubscription(subscription: Subscription): Promise<Subscription> {
    this.subs.set(subscription.id, subscription);
    return subscription;
  }

  async standingOrders(): Promise<StandingOrder[]> {
    return [...this.standing.values()];
  }

  async getStandingOrder(id: string): Promise<StandingOrder | undefined> {
    return this.standing.get(id);
  }

  async saveStandingOrder(standingOrder: StandingOrder): Promise<StandingOrder> {
    this.standing.set(standingOrder.id, standingOrder);
    return standingOrder;
  }
}
