import { describe, it, expect } from 'vitest';
import { DriverSyncService } from './driver-sync.service';

describe('DriverSyncService', () => {
  it('starts empty', () => { expect(new DriverSyncService().list()).toEqual([]); });
});
