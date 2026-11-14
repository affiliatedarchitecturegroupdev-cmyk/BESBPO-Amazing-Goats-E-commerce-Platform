import { describe, it, expect } from 'vitest';
import { InMemoryConsentStore, decideConsent } from './consent';

describe('decideConsent', () => {
  it('allows a transactional message without any consent record', () => {
    const store = new InMemoryConsentStore();
    expect(
      decideConsent(store, { contactId: 'c1', channel: 'email', kind: 'transactional' }),
    ).toEqual({
      allowed: true,
      reason: 'transactional',
    });
  });

  it('allows marketing only when the contact opted in to that exact channel', () => {
    const store = new InMemoryConsentStore([{ contactId: 'c1', marketing: ['email'] }]);
    expect(decideConsent(store, { contactId: 'c1', channel: 'email', kind: 'marketing' })).toEqual({
      allowed: true,
      reason: 'opted_in',
    });
    expect(
      decideConsent(store, { contactId: 'c1', channel: 'whatsapp', kind: 'marketing' }),
    ).toEqual({
      allowed: false,
      reason: 'no_consent',
    });
  });

  it('never sends marketing to an unknown contact', () => {
    const store = new InMemoryConsentStore();
    expect(
      decideConsent(store, { contactId: 'nobody', channel: 'email', kind: 'marketing' }),
    ).toEqual({
      allowed: false,
      reason: 'unknown_contact',
    });
  });

  it('reads a contact added after construction', () => {
    const store = new InMemoryConsentStore();
    store.set({ contactId: 'c2', marketing: ['sms'] });
    expect(
      decideConsent(store, { contactId: 'c2', channel: 'sms', kind: 'marketing' }).allowed,
    ).toBe(true);
  });
});
