import { describe, it, expect } from 'vitest';
import { InvoicesService } from './invoices.service';

describe('InvoicesService', () => {
  it('starts empty', () => { expect(new InvoicesService().list()).toEqual([]); });
});
