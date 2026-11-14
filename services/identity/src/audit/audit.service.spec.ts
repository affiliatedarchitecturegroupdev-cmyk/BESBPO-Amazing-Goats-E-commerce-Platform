import { describe, it, expect } from 'vitest';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  it('starts empty', () => { expect(new AuditService().list()).toEqual([]); });
});
