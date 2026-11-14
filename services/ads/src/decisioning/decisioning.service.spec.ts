import { describe, it, expect } from 'vitest';
import { DecisioningService } from './decisioning.service';

describe('DecisioningService', () => {
  it('starts empty', () => { expect(new DecisioningService().list()).toEqual([]); });
});
