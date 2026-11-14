import { describe, it, expect } from 'vitest';
import { PayoutsService } from './payouts.service';

describe('PayoutsService', () => {
  it('starts empty', () => { expect(new PayoutsService().list()).toEqual([]); });
});
