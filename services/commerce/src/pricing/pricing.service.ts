import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PricingStore } from './pricing.store';
import { PriceList, PriceListAudience, ResolvedPrice } from './pricing.types';
import {
  PricingError,
  activeListFor,
  publish,
  resolvePrice,
  resolvePrices,
  submitForApproval,
  supersedeOthers,
} from './pricing.rules';
import { VAT_RATE_PERCENT } from './vat';

export const PRICING_STORE = Symbol('PRICING_STORE');

@Injectable()
export class PricingService {
  constructor(@Inject(PRICING_STORE) private readonly store: PricingStore) {}

  async list(): Promise<PriceList[]> {
    return (await this.store.all()).sort((a, b) => a.code.localeCompare(b.code));
  }

  async get(id: string): Promise<PriceList> {
    const list = await this.store.get(id);
    if (!list) throw new NotFoundException(`unknown price list ${id}`);
    return list;
  }

  async create(list: PriceList): Promise<PriceList> {
    if ((await this.store.get(list.id)) || (await this.findByCode(list.code))) {
      throw new PricingError(`price list ${list.code} already exists`);
    }
    return this.store.insert({ ...list, status: 'draft' });
  }

  /** Submit a draft for approval, recording who asked. */
  async submit(id: string, requestedBy: string): Promise<PriceList> {
    const list = await this.get(id);
    return this.store.replace(submitForApproval(list, requestedBy));
  }

  /**
   * Publish a submitted list. A second person must approve; publishing
   * supersedes any other live list for the same audience.
   */
  async approve(id: string, approverUserId: string, at: Date = new Date()): Promise<PriceList> {
    const list = await this.get(id);
    const published = publish(list, approverUserId, at);
    const others = supersedeOthers(await this.store.all(), published);
    for (const other of others) await this.store.replace(other);
    return this.store.replace(published);
  }

  /** The live list for an audience, or null. */
  async activeFor(audience: PriceListAudience, at: Date = new Date()): Promise<PriceList | null> {
    return activeListFor(await this.store.all(), audience, at);
  }

  /** One SKU's price for an audience, with the VAT breakdown. */
  async priceFor(
    audience: PriceListAudience,
    sku: string,
    at: Date = new Date(),
    ratePercent: number = VAT_RATE_PERCENT,
  ): Promise<ResolvedPrice | null> {
    return resolvePrice(await this.store.all(), audience, sku, at, ratePercent);
  }

  /** Many SKUs at once, all from the same list version. */
  async priceMany(
    audience: PriceListAudience,
    skus: string[],
    at: Date = new Date(),
    ratePercent: number = VAT_RATE_PERCENT,
  ): Promise<Record<string, ResolvedPrice>> {
    return resolvePrices(await this.store.all(), audience, skus, at, ratePercent);
  }

  private async findByCode(code: string): Promise<PriceList | undefined> {
    return (await this.store.all()).find((l) => l.code === code);
  }
}
