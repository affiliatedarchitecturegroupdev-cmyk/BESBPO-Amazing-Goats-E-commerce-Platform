import { describe, it, expect } from 'vitest';
import { SlotsService } from './slots.service';

describe('SlotsService', () => {
  it('starts empty', () => { expect(new SlotsService().list()).toEqual([]); });
});
