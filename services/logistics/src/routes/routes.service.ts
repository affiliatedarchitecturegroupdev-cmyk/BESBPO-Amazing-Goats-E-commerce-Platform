import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SLOT_STORE } from '../slots/slots.service';
import { SlotStore } from '../slots/slots.store';
import { Route } from './routes.types';
import { CapacityCheck, checkRouteCapacity } from './route-domain';
import { RouteStore } from './routes.store';

export const ROUTE_STORE = Symbol('ROUTE_STORE');

@Injectable()
export class RoutesService {
  constructor(
    @Inject(ROUTE_STORE) private readonly store: RouteStore,
    @Inject(SLOT_STORE) private readonly slots: SlotStore,
  ) {}

  async list(): Promise<Route[]> {
    return (await this.store.list()).sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.name.localeCompare(b.name));
  }

  async get(id: string): Promise<Route> {
    const route = await this.store.get(id);
    if (!route) throw new NotFoundException(`unknown route ${id}`);
    return route;
  }

  /** Enforce route capacity before adding boxes to a route. */
  async capacity(id: string, boxes: number): Promise<CapacityCheck> {
    return checkRouteCapacity(await this.get(id), await this.slots.list(), boxes);
  }
}
