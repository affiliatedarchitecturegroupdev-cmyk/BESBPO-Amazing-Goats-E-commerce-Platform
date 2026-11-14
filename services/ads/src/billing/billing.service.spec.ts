import { describe, it, expect } from 'vitest';
import { BillingService } from './billing.service';

describe('BillingService', () => {
  it('starts empty', () => { expect(new BillingService().list()).toEqual([]); });
});
