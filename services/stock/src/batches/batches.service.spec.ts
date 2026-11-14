import { describe, it, expect } from 'vitest';
import { BatchesService } from './batches.service';

describe('BatchesService', () => {
  it('starts empty', () => { expect(new BatchesService().list()).toEqual([]); });
});
