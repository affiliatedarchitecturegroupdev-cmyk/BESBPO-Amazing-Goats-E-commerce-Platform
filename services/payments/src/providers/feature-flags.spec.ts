import { describe, it, expect } from 'vitest';
import { featureEnabled, lulapayEnabled } from './feature-flags';

describe('feature flags', () => {
  it('is on only for the exact string true', () => {
    expect(featureEnabled('X', { X: 'true' } as NodeJS.ProcessEnv)).toBe(true);
    expect(featureEnabled('X', { X: 'false' } as NodeJS.ProcessEnv)).toBe(false);
    expect(featureEnabled('X', { X: '1' } as NodeJS.ProcessEnv)).toBe(false);
    expect(featureEnabled('X', {} as NodeJS.ProcessEnv)).toBe(false);
  });

  it('reads the LulaPay pilot flag by name', () => {
    expect(lulapayEnabled({ LULAPAY_ENABLED: 'true' } as NodeJS.ProcessEnv)).toBe(true);
    expect(lulapayEnabled({} as NodeJS.ProcessEnv)).toBe(false);
  });
});
