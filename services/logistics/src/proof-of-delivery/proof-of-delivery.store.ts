import { ProofOfDelivery } from './proof-of-delivery.types';

/**
 * Persistence boundary for proof of delivery. Keyed by stop, because a stop is
 * proved once: `save` is therefore an insert-or-nothing, not an update.
 */
export interface ProofOfDeliveryStore {
  list(): Promise<ProofOfDelivery[]>;
  /** The proof for a stop, or undefined when the stop is not proved yet. */
  get(stopId: string): Promise<ProofOfDelivery | undefined>;
  /**
   * Store a proof unless the stop already has one. Returns the record that is
   * now stored, which is the existing one when the stop was already proved, so
   * a replayed sync reports the same proof instead of overwriting it.
   */
  save(proof: ProofOfDelivery): Promise<ProofOfDelivery>;
}

/** In-memory store used by tests and local runs until `STORE_DRIVER=sql`. */
export class InMemoryProofOfDeliveryStore implements ProofOfDeliveryStore {
  private readonly byStop = new Map<string, ProofOfDelivery>();

  constructor(seed: ProofOfDelivery[] = []) {
    for (const proof of seed) this.byStop.set(proof.stopId, proof);
  }

  async list(): Promise<ProofOfDelivery[]> {
    return [...this.byStop.values()];
  }

  async get(stopId: string): Promise<ProofOfDelivery | undefined> {
    return this.byStop.get(stopId);
  }

  async save(proof: ProofOfDelivery): Promise<ProofOfDelivery> {
    const existing = this.byStop.get(proof.stopId);
    if (existing) return existing;
    this.byStop.set(proof.stopId, proof);
    return proof;
  }
}
