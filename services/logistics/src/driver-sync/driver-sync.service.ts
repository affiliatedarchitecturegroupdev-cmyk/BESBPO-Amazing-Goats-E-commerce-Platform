import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { applyDeliveryStatus, orderEvents, receiveEvents } from './driver-sync-domain';
import { SyncEventStore } from './driver-sync.store';
import { DeliveryStatus, DriverEvent, ReceiveResult } from './driver-sync.types';

export const SYNC_EVENT_STORE = Symbol('SYNC_EVENT_STORE');

@Injectable()
export class DriverSyncService {
  constructor(@Inject(SYNC_EVENT_STORE) private readonly store: SyncEventStore) {}

  /** Batches received from a device, newest first. */
  async list(): Promise<DriverEvent[]> {
    return orderEvents(await this.store.list()).reverse();
  }

  /**
   * Accept a batch of offline events. Idempotent: events whose client-generated
   * UUID has already been seen are counted as duplicates and not stored again, so
   * a driver syncing twice is safe.
   */
  async receive(events: DriverEvent[]): Promise<ReceiveResult> {
    if (!Array.isArray(events) || events.length === 0) throw new BadRequestException('no events supplied');
    for (const event of events) {
      if (!event.id || !event.deviceId || !event.stopId || !event.occurredAt) {
        throw new BadRequestException('each event needs id, deviceId, stopId and occurredAt');
      }
    }

    const ordered = orderEvents(events);
    const alreadySeen = new Set<string>();
    for (const event of ordered) {
      if (await this.store.seen(event.id)) alreadySeen.add(event.id);
    }

    const { accepted, duplicates, fresh } = receiveEvents(ordered, alreadySeen);
    for (const event of fresh) await this.store.insert(event);
    await this.store.markApplied(fresh.map((e) => e.id));
    return { accepted, duplicates };
  }

  /** Delivery status after replaying a stop's events under the conflict rule. */
  async deliveryStatus(stopId: string, current: DeliveryStatus = 'pending'): Promise<DeliveryStatus> {
    const events = orderEvents((await this.store.list()).filter((e) => e.stopId === stopId));
    return events.reduce((status, event) => applyDeliveryStatus(status, event), current);
  }
}
