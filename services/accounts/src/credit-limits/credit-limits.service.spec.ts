import { describe, it, expect } from 'vitest';
import { CreditLimitsService } from './credit-limits.service';

describe('CreditLimitsService', () => {
  it('starts empty', () => { expect(new CreditLimitsService().list()).toEqual([]); });
});
