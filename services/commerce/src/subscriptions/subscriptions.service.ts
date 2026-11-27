import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { CycleRecord } from '../cycles/cycle-engine';
import type { Caller } from '../orders/order-access';
import {
  PublicSubscription,
  canViewSubscription,
  toPublicSubscription,
} from './subscription-access';
import {
  SubscriptionError,
  advance,
  assertValidStandingOrder,
  dueStandingOrders,
  dueSubscriptions,
  openCycleFor,
  pause,
  resume,
} from './subscriptions.rules';
import { SubscriptionStore } from './subscriptions.store';
import { DueRun, StandingOrder, Subscription } from './subscriptions.types';

export const SUBSCRIPTION_STORE = Symbol('SUBSCRIPTION_STORE');
export const CYCLE_SOURCE = Symbol('CYCLE_SOURCE');

/** Reads the cycles a run may be assigned to. */
export interface CycleSource {
  list(): Promise<CycleRecord[]>;
}

@Injectable()
export class SubscriptionsService {
  constructor(
    @Inject(SUBSCRIPTION_STORE) private readonly store: SubscriptionStore,
    @Inject(CYCLE_SOURCE) private readonly cycles: CycleSource,
  ) {}

  async list(): Promise<Subscription[]> {
    return (await this.store.subscriptions()).sort((a, b) => a.nextRunAt.localeCompare(b.nextRunAt));
  }

  async get(id: string): Promise<Subscription> {
    const subscription = await this.store.getSubscription(id);
    if (!subscription) throw new NotFoundException(`unknown subscription ${id}`);
    return subscription;
  }

  /**
   * The shopper's own subscriptions (`/account`). Behind `@RequireAuthenticated`
   * rather than `orders:read`, because a customer does not hold that permission
   * and must not gain it to see their own schedule.
   */
  async mySubscriptions(caller: Caller): Promise<PublicSubscription[]> {
    if (!caller.userId) throw new UnauthorizedException('sign in to see your subscriptions');
    return (await this.store.listByCustomer(caller.userId)).map(toPublicSubscription);
  }

  /**
   * One subscription, for its owner or staff. A caller who does not own it gets
   * the same 404 as one asking for a subscription that does not exist, so the
   * response cannot be used to test whether an id is real.
   */
  async mySubscription(id: string, caller: Caller): Promise<PublicSubscription> {
    return toPublicSubscription(await this.ownedSubscription(id, caller));
  }

  /**
   * Pause or resume a subscription the caller owns. The transition reuses
   * `pause`/`resume` from the rules, so a shopper's pause and a staff pause mean
   * the same thing and `nextRunAt` is left alone (a pause is not a skip).
   */
  async setPausedByOwner(id: string, paused: boolean, caller: Caller): Promise<PublicSubscription> {
    const subscription = await this.ownedSubscription(id, caller);
    const next = paused ? pause(subscription) : resume(subscription);
    return toPublicSubscription(await this.store.saveSubscription(next));
  }

  /** Read a subscription the caller is allowed to see, or throw the same 404 either way. */
  private async ownedSubscription(id: string, caller: Caller): Promise<Subscription> {
    if (!caller.userId && !caller.staff) {
      throw new UnauthorizedException('sign in to see your subscriptions');
    }
    const subscription = await this.store.getSubscription(id);
    if (!subscription || !canViewSubscription(subscription, caller)) {
      throw new NotFoundException(`unknown subscription ${id}`);
    }
    return subscription;
  }

  /** Create a subscription; `nextRunAt` is required so the first run is explicit. */
  async create(subscription: Subscription): Promise<Subscription> {
    if (!subscription.id) throw new SubscriptionError('a subscription needs an id');
    if (Number.isNaN(Date.parse(subscription.nextRunAt))) {
      throw new SubscriptionError('nextRunAt must be a valid ISO instant');
    }
    return this.store.saveSubscription({ ...subscription, paused: subscription.paused ?? false });
  }

  async pause(id: string): Promise<Subscription> {
    return this.store.saveSubscription(pause(await this.get(id)));
  }

  async resume(id: string): Promise<Subscription> {
    return this.store.saveSubscription(resume(await this.get(id)));
  }

  /** Run a due subscription now: advance it one cadence and return the cycle it lands in. */
  async run(id: string, at: Date = new Date()): Promise<{ subscription: Subscription; cycle: CycleRecord | null }> {
    const subscription = await this.get(id);
    const cycles = await this.cycles.list();
    const cycle = openCycleFor(cycles, at);
    const next = advance(subscription, at, false);
    return { subscription: await this.store.saveSubscription(next), cycle };
  }

  /** Skip the next run: the cadence still advances, so the schedule is preserved. */
  async skip(id: string, at: Date = new Date()): Promise<Subscription> {
    return this.store.saveSubscription(advance(await this.get(id), at, true));
  }

  /** Every subscription due at `at`, paired with the cycle it would land in. */
  async due(at: Date = new Date()): Promise<DueRun<Subscription>[]> {
    return dueSubscriptions(await this.store.subscriptions(), await this.cycles.list(), at);
  }

  // --- Standing orders -----------------------------------------------------

  async listStandingOrders(): Promise<StandingOrder[]> {
    return (await this.store.standingOrders()).sort((a, b) => a.id.localeCompare(b.id));
  }

  async getStandingOrder(id: string): Promise<StandingOrder> {
    const standing = await this.store.getStandingOrder(id);
    if (!standing) throw new NotFoundException(`unknown standing order ${id}`);
    return standing;
  }

  async createStandingOrder(standing: StandingOrder): Promise<StandingOrder> {
    assertValidStandingOrder(standing);
    return this.store.saveStandingOrder({ ...standing, active: standing.active ?? true });
  }

  async setStandingOrderActive(id: string, active: boolean): Promise<StandingOrder> {
    const standing = await this.getStandingOrder(id);
    return this.store.saveStandingOrder({ ...standing, active });
  }

  /** Every standing order due at `at`, paired with the cycle it would land in. */
  async dueStanding(at: Date = new Date()): Promise<DueRun<StandingOrder>[]> {
    return dueStandingOrders(await this.store.standingOrders(), await this.cycles.list(), at);
  }
}
