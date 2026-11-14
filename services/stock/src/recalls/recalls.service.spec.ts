import { describe, it, expect } from 'vitest';
import { RecallsService } from './recalls.service';

describe('RecallsService', () => {
  it('starts empty', () => { expect(new RecallsService().list()).toEqual([]); });
});
