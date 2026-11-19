import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { judgeCapture, proofFromCapture } from './proof-of-delivery-domain';
import { ProofOfDeliveryStore } from './proof-of-delivery.store';
import { CaptureInput, ProofOfDelivery } from './proof-of-delivery.types';

export const PROOF_OF_DELIVERY_STORE = Symbol('PROOF_OF_DELIVERY_STORE');

/** The clock, injected so a capture's default timestamp is testable. */
export const PROOF_CLOCK = Symbol('PROOF_CLOCK');

@Injectable()
export class ProofOfDeliveryService {
  constructor(
    @Inject(PROOF_OF_DELIVERY_STORE) private readonly store: ProofOfDeliveryStore,
    @Optional() @Inject(PROOF_CLOCK) private readonly now: () => Date = () => new Date(),
  ) {}

  /** Every proof the caller may see, newest capture first. RLS does the scoping. */
  async list(): Promise<ProofOfDelivery[]> {
    const proofs = await this.store.list();
    return proofs.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  }

  /** The proof for one stop. A customer reaches their own through RLS. */
  async get(stopId: string): Promise<ProofOfDelivery> {
    const proof = await this.store.get(stopId);
    if (!proof) throw new NotFoundException(`no proof of delivery for stop ${stopId}`);
    return proof;
  }

  /**
   * Capture proof for a stop. Idempotent per stop: a replayed offline sync
   * returns the proof already stored rather than creating a second one or
   * overwriting the evidence.
   *
   * A cold-chain excursion is recorded and flagged, not refused — the evidence
   * matters more than a clean record — but a capture with no evidence at all, or
   * a probe reading no probe could produce, is rejected so the driver fixes it
   * on the screen instead of syncing a record that means nothing.
   */
  async capture(stopId: string, input: CaptureInput): Promise<ProofOfDelivery> {
    if (!stopId?.trim()) throw new BadRequestException('a stop id is required');

    const check = judgeCapture(input);
    if (check.problems.length > 0) {
      throw new BadRequestException(`capture rejected: ${check.problems.join(', ')}`);
    }

    return this.store.save(proofFromCapture(stopId.trim(), input, 'chilled', this.now()));
  }
}
