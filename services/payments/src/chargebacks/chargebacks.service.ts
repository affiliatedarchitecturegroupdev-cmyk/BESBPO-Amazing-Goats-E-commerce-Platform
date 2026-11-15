import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ChargebacksStore } from './chargebacks.store';
import { Chargeback } from './chargebacks.types';
import { PayoutsService } from '../payouts/payouts.service';

export const CHARGEBACKS_STORE = Symbol('CHARGEBACKS_STORE');

/** Injection token for the clock, so tests can freeze time. */
export const CHARGEBACKS_CLOCK = 'AG_CHARGEBACKS_CLOCK';

@Injectable()
export class ChargebacksService {
  constructor(
    @Inject(CHARGEBACKS_STORE) private readonly store: ChargebacksStore,
    private readonly payouts: PayoutsService,
    @Optional() @Inject(CHARGEBACKS_CLOCK) private readonly now: () => Date = () => new Date(),
  ) {}

  async list(): Promise<Chargeback[]> {
    return (await this.store.all()).sort((a, b) => a.id.localeCompare(b.id));
  }

  async get(id: string): Promise<Chargeback> {
    const chargeback = await this.store.get(id);
    if (!chargeback) throw new NotFoundException(`unknown chargeback ${id}`);
    return chargeback;
  }

  /**
   * Record a chargeback and freeze the payout it claws back, so the money is held
   * before it leaves. A chargeback always arrives against a payment and the payout
   * raised for it.
   */
  async receive(
    input: Omit<Chargeback, 'status' | 'receivedAt'> & { receivedAt?: string },
  ): Promise<Chargeback> {
    const chargeback = await this.store.insert({
      ...input,
      status: 'received',
      receivedAt: input.receivedAt ?? this.now().toISOString(),
    });
    await this.payouts.freeze(chargeback.payoutId);
    return chargeback;
  }
}
