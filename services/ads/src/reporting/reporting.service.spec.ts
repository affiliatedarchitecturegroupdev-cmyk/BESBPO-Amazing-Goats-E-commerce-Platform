import { describe, it, expect } from 'vitest';
import { ReportingService } from './reporting.service';

describe('ReportingService', () => {
  it('starts empty', () => { expect(new ReportingService().list()).toEqual([]); });
});
