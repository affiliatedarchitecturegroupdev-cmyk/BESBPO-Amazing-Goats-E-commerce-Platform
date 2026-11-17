import { describe, it, expect } from 'vitest';
import { InMemoryConsentStore, decideConsent } from './consent';

describe('decideConsent', () => {
  it('allows a transactional message without any consent record', async () => {
    const store = new InMemoryConsentStore();
    await expect(
      decideConsent(store, { contactId: 'c1', channel: 'email', kind: 'transactional' }),
    ).resolves.toEqual({
      allowed: true,
      reason: 'transactional',
    });
  });

  it('allows marketing only when the contact opted in to that exact channel', async () => {
    const store = new InMemoryConsentStore([{ contactId: 'c1', marketing: ['email'] }]);
    await expect(
      decideConsent(store, { contactId: 'c1', channel: 'email', kind: 'marketing' }),
    ).resolves.toEqual({
      allowed: true,
      reason: 'opted_in',
    });
    await expect(
      decideConsent(store, { contactId: 'c1', channel: 'whatsapp', kind: 'marketing' }),
    ).resolves.toEqual({
      allowed: false,
      reason: 'no_consent',
    });
  });

  it('never sends marketing to an unknown contact', async () => {
    const store = new InMemoryConsentStore();
    await expect(
      decideConsent(store, { contactId: 'nobody', channel: 'email', kind: 'marketing' }),
    ).resolves.toEqual({
      allowed: false,
      reason: 'unknown_contact',
    });
  });

  it('reads a contact added after construction', async () => {
    const store = new InMemoryConsentStore();
    store.set({ contactId: 'c2', marketing: ['sms'] });
    const decision = await decideConsent(store, {
      contactId: 'c2',
      channel: 'sms',
      kind: 'marketing',
    });
    expect(decision.allowed).toBe(true);
  });
});
