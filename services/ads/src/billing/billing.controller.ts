import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { BillingService, WalletSummary } from './billing.service';
import { WalletError } from './wallet.rules';

interface TopUpBody {
  advertiserOrgId: string;
  amountCents: number;
  ref?: string;
}

interface SpendBody {
  advertiserOrgId: string;
  spendCents: number;
  ref?: string;
}

/**
 * Advertiser wallet. Reads are behind `ads:read`, movements behind `ads:manage`;
 * a spend that would overdraw is refused with a 400 before anything is written.
 */
@Controller('ads/billing')
export class BillingController {
  constructor(private readonly service: BillingService) {}

  @Get(':advertiserOrgId')
  @RequirePermissions('ads:read')
  wallet(@Param('advertiserOrgId') advertiserOrgId: string): Promise<WalletSummary> {
    return this.service.wallet(advertiserOrgId);
  }

  @Post('top-up')
  @RequirePermissions('ads:manage')
  async topUp(@Body() body: TopUpBody): Promise<{ balanceCents: number }> {
    try {
      return { balanceCents: await this.service.topUp(body.advertiserOrgId, body.amountCents, body.ref) };
    } catch (err) {
      if (err instanceof WalletError) throw new BadRequestException(err.message);
      throw err;
    }
  }

  @Post('spend')
  @RequirePermissions('ads:manage')
  async spend(@Body() body: SpendBody): Promise<{ balanceCents: number }> {
    try {
      return { balanceCents: await this.service.spend(body.advertiserOrgId, body.spendCents, body.ref) };
    } catch (err) {
      if (err instanceof WalletError) throw new BadRequestException(err.message);
      throw err;
    }
  }
}
