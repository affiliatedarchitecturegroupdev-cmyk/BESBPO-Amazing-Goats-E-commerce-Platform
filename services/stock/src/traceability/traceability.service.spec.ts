import { describe, it, expect } from 'vitest';
import { TraceabilityService } from './traceability.service';

describe('TraceabilityService', () => {
  it('starts empty', () => { expect(new TraceabilityService().list()).toEqual([]); });
});
