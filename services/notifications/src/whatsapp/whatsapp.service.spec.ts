import { describe, it, expect } from 'vitest';
import { WhatsappService } from './whatsapp.service';

describe('WhatsappService', () => {
  it('starts empty', () => { expect(new WhatsappService().list()).toEqual([]); });
});
