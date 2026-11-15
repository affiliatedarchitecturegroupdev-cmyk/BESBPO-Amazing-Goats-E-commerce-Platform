import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Method, Provider } from '../routing/route-payment';
import type { PaymentProvider } from './provider.interface';
import { PeachProvider } from './peach.provider';
import { PayFastProvider } from './payfast.provider';
import { StitchProvider } from './stitch.provider';

/** Injection token for the registered adapters, so tests can supply fakes. */
export const PROVIDER_REGISTRY = Symbol('PROVIDER_REGISTRY');

export interface ProviderDescriptor {
  id: Provider;
  methods: Method[];
}

/**
 * Holds the provider adapters. Routing (`routePayment`) decides the order; the
 * registry turns a provider id into the adapter that talks to it.
 */
@Injectable()
export class ProvidersService {
  private readonly byId = new Map<Provider, PaymentProvider>();

  constructor(@Inject(PROVIDER_REGISTRY) providers: PaymentProvider[] = []) {
    for (const provider of providers) this.register(provider);
  }

  register(provider: PaymentProvider): void {
    this.byId.set(provider.id, provider);
  }

  has(id: Provider): boolean {
    return this.byId.has(id);
  }

  get(id: Provider): PaymentProvider {
    const provider = this.byId.get(id);
    if (!provider) throw new NotFoundException(`provider ${id} is not configured`);
    return provider;
  }

  list(): ProviderDescriptor[] {
    const methods: Method[] = [
      'pay_by_bank',
      'card',
      'wallet',
      'bnpl',
      'recurring_debit',
      'escrow',
      'trade_bnpl',
      'pos',
    ];
    return [...this.byId.values()].map((provider) => ({
      id: provider.id,
      methods: methods.filter((m) => provider.supports(m)),
    }));
  }
}

/**
 * Builds the adapter list from the environment. Peach is registered when its
 * credentials are present; a missing provider is simply not routed to, rather
 * than failing every request at start-up.
 */
export function providersFromEnv(env: NodeJS.ProcessEnv = process.env): PaymentProvider[] {
  const providers: PaymentProvider[] = [];
  if (env.PEACH_ENTITY_ID && env.PEACH_ACCESS_TOKEN) {
    providers.push(
      new PeachProvider({
        entityId: env.PEACH_ENTITY_ID,
        accessToken: env.PEACH_ACCESS_TOKEN,
        webhookSecret: env.PEACH_WEBHOOK_SECRET ?? '',
      }),
    );
  }
  if (env.PAYFAST_MERCHANT_ID && env.PAYFAST_MERCHANT_KEY) {
    providers.push(
      new PayFastProvider({
        merchantId: env.PAYFAST_MERCHANT_ID,
        merchantKey: env.PAYFAST_MERCHANT_KEY,
        passphrase: env.PAYFAST_PASSPHRASE ?? '',
      }),
    );
  }
  if (env.STITCH_CLIENT_ID && env.STITCH_CLIENT_SECRET) {
    providers.push(
      new StitchProvider({
        clientId: env.STITCH_CLIENT_ID,
        clientSecret: env.STITCH_CLIENT_SECRET,
        webhookSecret: env.STITCH_WEBHOOK_SECRET ?? '',
      }),
    );
  }
  return providers;
}
