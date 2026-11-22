import { Inject, Injectable } from '@nestjs/common';
import type { DeliveryRecord, SuppressionEntry, DeliveryStore, SuppressionStore } from './delivery';
import { DELIVERY_STORE, SUPPRESSION_STORE } from './delivery';

@Injectable()
export class DeliveryService {
  constructor(
    @Inject(DELIVERY_STORE) private readonly deliveries: DeliveryStore,
    @Inject(SUPPRESSION_STORE) private readonly suppressions: SuppressionStore,
  ) {}

  forMessage(providerRef: string): Promise<DeliveryRecord[]> {
    return this.deliveries.forMessage(providerRef);
  }

  suppressed(): Promise<SuppressionEntry[]> {
    return this.suppressions.list();
  }
}
