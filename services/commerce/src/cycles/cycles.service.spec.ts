import { describe, it, expect } from 'vitest';
import { CyclesService } from './cycles.service';

describe('CyclesService', () => {
  it('starts empty', () => { expect(new CyclesService().list()).toEqual([]); });
});
