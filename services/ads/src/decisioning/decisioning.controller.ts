import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { DecisioningService } from './decisioning.service';
import type { AdPlacement } from './serve-ads';

interface ClickBody {
  creativeId: string;
  userHash?: string;
}

/**
 * Retail-media decisioning. The serve route is public (the storefront calls it)
 * and only returns ads already gated by campaign approval; the click route is
 * likewise open so a click can be attributed without a session.
 */
@Controller('ads/decisioning')
export class DecisioningController {
  constructor(private readonly service: DecisioningService) {}

  @Get('serve')
  serve(
    @Query('slot') slot: string,
    @Query('category') category?: string,
    @Query('maxAds') maxAds?: string,
    @Query('userHash') userHash?: string,
  ): Promise<AdPlacement[]> {
    return this.service.serve({ slot, category, maxAds: maxAds ? Number(maxAds) : undefined, userHash });
  }

  @Post('click')
  click(@Body() body: ClickBody): Promise<void> {
    return this.service.click(body.creativeId, body.userHash);
  }

  /** Staff view of the raw decisioning inputs, behind RBAC. */
  @Get('slots')
  @RequirePermissions('ads:read')
  slots(): { slots: string[] } {
    return { slots: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11', 'A12'] };
  }
}
