import { describe, it, expect } from 'vitest';
import { DocumentsService } from './documents.service';

describe('DocumentsService', () => {
  it('starts empty', () => { expect(new DocumentsService().list()).toEqual([]); });
});
