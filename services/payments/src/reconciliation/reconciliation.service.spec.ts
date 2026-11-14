import { describe, it, expect } from 'vitest';
import { ReconciliationService } from './reconciliation.service';

describe('ReconciliationService', () => {
  it('starts empty', () => { expect(new ReconciliationService().list()).toEqual([]); });
});
