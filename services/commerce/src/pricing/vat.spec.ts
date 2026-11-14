import { describe, it, expect } from 'vitest';
import { addVat, removeVat } from './vat';

describe('vat', () => {
  it('adds 15%', () => { expect(addVat(270000)).toBe(310500); });
  it('removes 15%', () => { expect(removeVat(310500)).toBe(270000); });
});
