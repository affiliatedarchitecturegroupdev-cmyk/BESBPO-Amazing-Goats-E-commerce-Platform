import { describe, it, expect } from 'vitest';
import { TemperatureService } from './temperature.service';

describe('TemperatureService', () => {
  it('starts empty', () => { expect(new TemperatureService().list()).toEqual([]); });
});
