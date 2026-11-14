import { describe, it, expect } from 'vitest';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('starts empty', () => { expect(new AuthService().list()).toEqual([]); });
});
