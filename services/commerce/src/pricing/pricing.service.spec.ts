import { describe, it, expect } from 'vitest';
import { PricingService } from './pricing.service';

describe('PricingService', () => {
  it('starts empty', () => { expect(new PricingService().list()).toEqual([]); });
});
