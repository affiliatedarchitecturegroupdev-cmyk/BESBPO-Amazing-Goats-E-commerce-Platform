import { describe, it, expect } from 'vitest';
import { RoutesService } from './routes.service';

describe('RoutesService', () => {
  it('starts empty', () => { expect(new RoutesService().list()).toEqual([]); });
});
