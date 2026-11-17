import type { Db } from '@ag/db';
import { currentSession, toIso } from '@ag/db';
import { Cadence, StandingOrder, StandingOrderLine, Subscription } from './subscriptions.types';
import { SubscriptionStore } from './subscriptions.store';

interface SubscriptionRow {
  external_id: string;
  customer_user_ref: string | null;
  bundle_ref: string | null;
  cadence: Cadence | null;
  next_run_at: Date | string | null;
  paused: boolean;
  skipped: string[] | null;
}

function toSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.external_id,
    customerUserId: row.customer_user_ref ?? '',
    bundleId: row.bundle_ref,
    cadence: row.cadence ?? 'weekly',
    nextRunAt: toIso(row.next_run_at),
    paused: row.paused,
    skipped: row.skipped ?? undefined,
  };
}

interface StandingOrderRow {
  external_id: string;
  org_ref: string | null;
  day_of_week: number;
  delivery_window: string | null;
  paused_until: Date | string | null;
  active: boolean;
  lines: StandingOrderLine[] | null;
}

function toStandingOrder(row: StandingOrderRow): StandingOrder {
  return {
    id: row.external_id,
    orgId: row.org_ref ?? '',
    dayOfWeek: row.day_of_week,
    deliveryWindow: row.delivery_window,
    pausedUntil: row.paused_until ? toIso(row.paused_until).slice(0, 10) : null,
    active: row.active,
    lines: row.lines ?? [],
  };
}

const SUB_COLUMNS =
  'external_id, customer_user_ref, bundle_ref, cadence, next_run_at, paused, skipped';
const SO_COLUMNS = 'external_id, org_ref, day_of_week, delivery_window, paused_until, active, lines';

/**
 * SQL adapter over `sales.subscriptions` and `sales.standing_orders`. The domain
 * keys on string ids (`sub_1`, `so_1`), carried in `external_id`; the customer
 * and organisation are domain ids too, so they live in `*_ref` columns. A
 * standing order's lines are edited wholesale, so they are stored as a jsonb
 * payload on the parent row.
 */
export class PgSubscriptionStore implements SubscriptionStore {
  constructor(private readonly db: Db) {}

  async subscriptions(): Promise<Subscription[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<SubscriptionRow>(`SELECT ${SUB_COLUMNS} FROM sales.subscriptions ORDER BY next_run_at`),
    );
    return rows.map(toSubscription);
  }

  async getSubscription(id: string): Promise<Subscription | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<SubscriptionRow>(`SELECT ${SUB_COLUMNS} FROM sales.subscriptions WHERE external_id = $1`, [id]),
    );
    return rows[0] ? toSubscription(rows[0]) : undefined;
  }

  async saveSubscription(subscription: Subscription): Promise<Subscription> {
    await this.db.withSession(currentSession(), (tx) =>
      tx.query(
        `INSERT INTO sales.subscriptions
           (external_id, customer_user_ref, bundle_ref, cadence, next_run_at, paused, skipped)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (external_id) DO UPDATE SET
           customer_user_ref = EXCLUDED.customer_user_ref, bundle_ref = EXCLUDED.bundle_ref,
           cadence = EXCLUDED.cadence, next_run_at = EXCLUDED.next_run_at,
           paused = EXCLUDED.paused, skipped = EXCLUDED.skipped`,
        [
          subscription.id,
          subscription.customerUserId,
          subscription.bundleId,
          subscription.cadence,
          subscription.nextRunAt,
          subscription.paused,
          subscription.skipped ?? [],
        ],
      ),
    );
    return subscription;
  }

  async standingOrders(): Promise<StandingOrder[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<StandingOrderRow>(`SELECT ${SO_COLUMNS} FROM sales.standing_orders ORDER BY external_id`),
    );
    return rows.map(toStandingOrder);
  }

  async getStandingOrder(id: string): Promise<StandingOrder | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<StandingOrderRow>(`SELECT ${SO_COLUMNS} FROM sales.standing_orders WHERE external_id = $1`, [id]),
    );
    return rows[0] ? toStandingOrder(rows[0]) : undefined;
  }

  async saveStandingOrder(standingOrder: StandingOrder): Promise<StandingOrder> {
    await this.db.withSession(currentSession(), (tx) =>
      tx.query(
        `INSERT INTO sales.standing_orders
           (external_id, org_ref, day_of_week, delivery_window, paused_until, active, lines)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (external_id) DO UPDATE SET
           org_ref = EXCLUDED.org_ref, day_of_week = EXCLUDED.day_of_week,
           delivery_window = EXCLUDED.delivery_window, paused_until = EXCLUDED.paused_until,
           active = EXCLUDED.active, lines = EXCLUDED.lines`,
        [
          standingOrder.id,
          standingOrder.orgId,
          standingOrder.dayOfWeek,
          standingOrder.deliveryWindow,
          standingOrder.pausedUntil,
          standingOrder.active,
          JSON.stringify(standingOrder.lines),
        ],
      ),
    );
    return standingOrder;
  }
}
