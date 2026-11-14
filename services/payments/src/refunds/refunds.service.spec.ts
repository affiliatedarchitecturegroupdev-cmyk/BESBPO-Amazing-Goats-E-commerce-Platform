import { describe, it, expect } from 'vitest';
import { RefundsService } from './refunds.service';

describe('RefundsService', () => {
  it('starts empty', () => { expect(new RefundsService().list()).toEqual([]); });
});
