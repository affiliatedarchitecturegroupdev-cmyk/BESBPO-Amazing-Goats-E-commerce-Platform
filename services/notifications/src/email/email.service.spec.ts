import { describe, it, expect } from 'vitest';
import { EmailService } from './email.service';

describe('EmailService', () => {
  it('starts empty', () => { expect(new EmailService().list()).toEqual([]); });
});
