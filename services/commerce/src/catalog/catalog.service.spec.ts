import { describe, it, expect } from 'vitest';
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  it('starts empty', () => { expect(new CatalogService().list()).toEqual([]); });
});
