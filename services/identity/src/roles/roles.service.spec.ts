import { describe, it, expect } from 'vitest';
import { RolesService } from './roles.service';

describe('RolesService', () => {
  it('starts empty', () => { expect(new RolesService().list()).toEqual([]); });
});
