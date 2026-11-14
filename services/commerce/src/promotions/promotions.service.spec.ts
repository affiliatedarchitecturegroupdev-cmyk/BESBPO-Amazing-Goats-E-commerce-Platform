import { describe, it, expect } from 'vitest';
import { PromotionsService } from './promotions.service';

describe('PromotionsService', () => {
  it('starts empty', () => { expect(new PromotionsService().list()).toEqual([]); });
});
