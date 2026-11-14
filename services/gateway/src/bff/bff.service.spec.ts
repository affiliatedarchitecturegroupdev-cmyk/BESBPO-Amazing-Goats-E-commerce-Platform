import { describe, it, expect } from 'vitest';
import { BffService } from './bff.service';

describe('BffService', () => {
  it('starts empty', () => { expect(new BffService().list()).toEqual([]); });
});
