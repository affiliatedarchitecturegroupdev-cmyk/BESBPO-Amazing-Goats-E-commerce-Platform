import { describe, it, expect } from 'vitest';
import { CreativesService } from './creatives.service';

describe('CreativesService', () => {
  it('starts empty', () => { expect(new CreativesService().list()).toEqual([]); });
});
