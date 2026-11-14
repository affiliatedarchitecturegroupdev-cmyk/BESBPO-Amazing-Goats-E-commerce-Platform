import { describe, it, expect } from 'vitest';
import { MerchandisingService } from './merchandising.service';

describe('MerchandisingService', () => {
  it('starts empty', () => { expect(new MerchandisingService().list()).toEqual([]); });
});
