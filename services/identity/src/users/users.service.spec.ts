import { describe, it, expect } from 'vitest';
import { UsersService } from './users.service';

describe('UsersService', () => {
  it('starts empty', () => { expect(new UsersService().list()).toEqual([]); });
});
