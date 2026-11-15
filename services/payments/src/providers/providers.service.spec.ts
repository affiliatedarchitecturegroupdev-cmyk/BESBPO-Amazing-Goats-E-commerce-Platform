import { describe, it, expect } from 'vitest';
import { ProvidersService, providersFromEnv } from './providers.service';
import type { PaymentProvider, WebhookEvent } from './provider.interface';
import type { Provider } from '../routing/route-payment';

class StubProvider implements PaymentProvider {
  constructor(readonly id: Provider) {}
  supports(): boolean {
    return true;
  }
  async createPayment() {
    return { providerRef: 'x', status: 'pending' as const };
  }
  async refund() {
    return { refundRef: 'r', status: 'pending' as const };
  }
  verifyWebhook(): WebhookEvent {
    throw new Error('not used');
  }
}

describe('ProvidersService', () => {
  it('starts empty when no adapters are registered', () => {
    expect(new ProvidersService().list()).toEqual([]);
  });

  it('registers adapters and lists their methods', () => {
    const service = new ProvidersService([new StubProvider('peach')]);
    expect(service.has('peach')).toBe(true);
    expect(service.get('peach').id).toBe('peach');
    expect(service.list()[0]).toMatchObject({ id: 'peach' });
    expect(service.list()[0].methods.length).toBeGreaterThan(0);
  });

  it('throws for an unconfigured provider', () => {
    expect(() => new ProvidersService().get('peach')).toThrow(/not configured/);
  });
});

describe('providersFromEnv', () => {
  it('registers no provider when no credentials are set', () => {
    expect(providersFromEnv({} as NodeJS.ProcessEnv)).toEqual([]);
  });

  it('registers TradeSafe when its credentials are present', () => {
    const providers = providersFromEnv({
      TRADESAFE_CLIENT_ID: 'id',
      TRADESAFE_CLIENT_SECRET: 'secret',
    } as NodeJS.ProcessEnv);
    const tradesafe = providers.find((p) => p.id === 'tradesafe');
    expect(tradesafe?.supports('escrow')).toBe(true);
  });

  it('registers LulaPay only when the pilot flag is on', () => {
    const base = { LULAPAY_API_KEY: 'key' } as NodeJS.ProcessEnv;
    expect(providersFromEnv(base).some((p) => p.id === 'lulapay')).toBe(false);
    const enabled = providersFromEnv({ ...base, LULAPAY_ENABLED: 'true' } as NodeJS.ProcessEnv);
    expect(enabled.find((p) => p.id === 'lulapay')?.supports('trade_bnpl')).toBe(true);
  });
});
