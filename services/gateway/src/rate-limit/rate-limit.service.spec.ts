import { describe, it, expect } from 'vitest';
import { RateLimitService } from './rate-limit.service';

describe('RateLimitService', () => {
  it('starts empty', () => { expect(new RateLimitService().list()).toEqual([]); });
});
