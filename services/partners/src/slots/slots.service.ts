import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { canConfirmSlot, confirmSlot, SlaughterSlot } from '../partner-domain';
import { PartnerStore, PARTNER_STORE } from '../partner.store';

@Injectable()
export class SlotsService {
  constructor(@Inject(PARTNER_STORE) private readonly store: PartnerStore) {}

  list(orgId: string): Promise<SlaughterSlot[]> {
    return this.store.slots(orgId);
  }

  /** Confirm a slot the org owns, once, and only while it is not overbooked. */
  async confirm(orgId: string, id: string): Promise<SlaughterSlot> {
    const slot = (await this.store.slots(orgId)).find((row) => row.id === id);
    if (!slot) throw new NotFoundException('slot not found');
    const check = canConfirmSlot(slot);
    if (!check.ok) throw new BadRequestException(check.reason);
    return this.store.saveSlot(confirmSlot(slot));
  }
}
