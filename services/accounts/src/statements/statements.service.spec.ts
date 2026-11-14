import { describe, it, expect } from 'vitest';
import { StatementsService } from './statements.service';

describe('StatementsService', () => {
  it('starts empty', () => { expect(new StatementsService().list()).toEqual([]); });
});
