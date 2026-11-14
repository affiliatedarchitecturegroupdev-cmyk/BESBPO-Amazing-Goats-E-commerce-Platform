import { describe, it, expect } from 'vitest';
import { ZonesService } from './zones.service';

describe('ZonesService', () => {
  it('starts empty', () => { expect(new ZonesService().list()).toEqual([]); });
});
