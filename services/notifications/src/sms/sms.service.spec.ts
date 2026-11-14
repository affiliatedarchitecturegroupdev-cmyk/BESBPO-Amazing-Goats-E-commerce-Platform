import { describe, it, expect } from 'vitest';
import { SmsService } from './sms.service';

describe('SmsService', () => {
  it('starts empty', () => { expect(new SmsService().list()).toEqual([]); });
});
