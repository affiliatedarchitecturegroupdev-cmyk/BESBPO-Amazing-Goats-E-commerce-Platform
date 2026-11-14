import { describe, it, expect } from 'vitest';
import { CreditApplicationsService } from './credit-applications.service';

describe('CreditApplicationsService', () => {
  it('starts empty', () => { expect(new CreditApplicationsService().list()).toEqual([]); });
});
