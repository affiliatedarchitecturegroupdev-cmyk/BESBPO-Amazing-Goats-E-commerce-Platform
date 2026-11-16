import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  PromotionError,
  applyPromotions,
  approvePromotion,
  assertValidPromotion,
  endPromotion,
} from './promotions.rules';
import { PromotionStore } from './promotions.store';
import { Promotion, PromotionCart, PromotionResult } from './promotions.types';

export const PROMOTION_STORE = Symbol('PROMOTION_STORE');

@Injectable()
export class PromotionsService {
  constructor(@Inject(PROMOTION_STORE) private readonly store: PromotionStore) {}

  async list(): Promise<Promotion[]> {
    return (await this.store.all()).sort((a, b) => a.code.localeCompare(b.code));
  }

  async get(id: string): Promise<Promotion> {
    const promotion = await this.store.get(id);
    if (!promotion) throw new NotFoundException(`unknown promotion ${id}`);
    return promotion;
  }

  /** Create a promotion as a draft; the value is validated up front. */
  async create(promotion: Promotion): Promise<Promotion> {
    if ((await this.store.get(promotion.id)) || (await this.findByCode(promotion.code))) {
      throw new PromotionError(`promotion ${promotion.code} already exists`);
    }
    assertValidPromotion(promotion);
    return this.store.insert({ ...promotion, status: 'draft' });
  }

  /** Approve a draft so it can run in its window. */
  async approve(id: string, approverUserId: string): Promise<Promotion> {
    const promotion = await this.get(id);
    return this.store.replace(approvePromotion(promotion, approverUserId));
  }

  /** Retire a promotion. */
  async end(id: string): Promise<Promotion> {
    const promotion = await this.get(id);
    return this.store.replace(endPromotion(promotion));
  }

  /** Price a cart: which promotions apply, and the money result. */
  async evaluate(cart: PromotionCart, at: Date = new Date()): Promise<PromotionResult> {
    return applyPromotions(cart, await this.store.all(), at);
  }

  private async findByCode(code: string): Promise<Promotion | undefined> {
    return (await this.store.all()).find((p) => p.code === code);
  }
}
