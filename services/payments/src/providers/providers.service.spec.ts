import { describe, it, expect } from 'vitest';
import { ProvidersService } from './providers.service';

describe('ProvidersService', () => {
  it('starts empty', () => { expect(new ProvidersService().list()).toEqual([]); });
});
