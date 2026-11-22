import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryQuote, GeoPoint, Zone } from './zones.types';
import { quoteDelivery } from './zone-domain';
import { checkArea, type AreaQuery, type ZoneCheck } from './zone-check.rules';
import { ZoneStore } from './zones.store';
import { ROUTE_STORE } from '../routes/routes.service';
import { RouteStore } from '../routes/routes.store';
import { SLOT_STORE } from '../slots/slots.service';
import { SlotStore } from '../slots/slots.store';

export const ZONE_STORE = Symbol('ZONE_STORE');

@Injectable()
export class ZonesService {
  constructor(
    @Inject(ZONE_STORE) private readonly store: ZoneStore,
    @Inject(ROUTE_STORE) private readonly routes: RouteStore,
    @Inject(SLOT_STORE) private readonly slots: SlotStore,
  ) {}

  async list(): Promise<Zone[]> {
    return (await this.store.list()).sort((a, b) => a.code.localeCompare(b.code));
  }

  async get(id: number): Promise<Zone> {
    const zone = await this.store.get(id);
    if (!zone) throw new NotFoundException(`unknown zone ${id}`);
    return zone;
  }

  /** Zone check at checkout for a delivery point. */
  async quote(point: GeoPoint, goodsTotalCents = 0): Promise<DeliveryQuote> {
    return quoteDelivery(point, await this.list(), goodsTotalCents);
  }

  /**
   * The pre-checkout area check: does this area get a delivery, when, and for
   * how much. Composed from the zone, its routes and the open slots, with the
   * cut-off from the shared engine, so the answer matches what the order meets.
   */
  async check(
    area: AreaQuery,
    opts: { goodsTotalCents?: number; now?: Date } = {},
  ): Promise<ZoneCheck> {
    const [zones, routes, slots] = await Promise.all([
      this.list(),
      this.routes.list(),
      this.slots.list(),
    ]);
    return checkArea(zones, area, { ...opts, routes, slots });
  }
}
