import { Inject, Injectable } from '@nestjs/common';
import { PurchaseOrder } from '../partner-domain';
import { PartnerStore, PARTNER_STORE } from '../partner.store';

@Injectable()
export class PurchaseOrdersService {
  constructor(@Inject(PARTNER_STORE) private readonly store: PartnerStore) {}

  list(orgId: string): Promise<PurchaseOrder[]> {
    return this.store.purchaseOrders(orgId);
  }
}
