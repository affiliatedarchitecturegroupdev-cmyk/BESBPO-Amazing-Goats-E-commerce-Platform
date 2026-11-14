import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryQuote, GeoPoint, Zone } from './zones.types';
import { quoteDelivery } from './zone-domain';
import { ZoneStore } from './zones.store';

export const ZONE_STORE = Symbol('ZONE_STORE');

@Injectable()
export class ZonesService {
  constructor(@Inject(ZONE_STORE) private readonly store: ZoneStore) {}

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
}
