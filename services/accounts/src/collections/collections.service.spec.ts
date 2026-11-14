import { describe, it, expect } from 'vitest';
import { CollectionsService } from './collections.service';

describe('CollectionsService', () => {
  it('starts empty', () => { expect(new CollectionsService().list()).toEqual([]); });
});
