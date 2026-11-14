import { describe, it, expect } from 'vitest';
import { ProofOfDeliveryService } from './proof-of-delivery.service';

describe('ProofOfDeliveryService', () => {
  it('starts empty', () => { expect(new ProofOfDeliveryService().list()).toEqual([]); });
});
