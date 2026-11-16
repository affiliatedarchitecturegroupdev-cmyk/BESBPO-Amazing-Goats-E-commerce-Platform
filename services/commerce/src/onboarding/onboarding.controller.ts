import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { OnboardingService } from './onboarding.service';
import { SupplierApplication } from './supplier-onboarding';

@Controller('commerce/onboarding')
export class OnboardingController {
  constructor(private readonly service: OnboardingService) {}

  /** The document requirements for a supplier kind (dairy, produce, eggs). */
  @Get('suppliers/:kind/requirements')
  @RequirePermissions('catalog:read')
  requirements(@Param('kind') kind: string) {
    return this.service.requirements(kind);
  }

  @Get('suppliers')
  @RequirePermissions('catalog:read')
  list(@Query('asOf') asOf?: string) {
    return this.service.list(asOf ? new Date(asOf) : new Date());
  }

  /** Lodge a supplier application; returns the onboarding decision. */
  @Post('suppliers')
  @RequirePermissions('catalog:write')
  submit(@Body() application: SupplierApplication) {
    return this.service.submit(application);
  }

  @Get('suppliers/:orgName/checklist')
  @RequirePermissions('catalog:read')
  checklist(@Param('orgName') orgName: string, @Query('asOf') asOf?: string) {
    return this.service.checklist(orgName, asOf ? new Date(asOf) : new Date());
  }

  /** Upcoming produce pre-order cycles and whether each is still open. */
  @Get('produce/cycles')
  @RequirePermissions('catalog:read')
  produceCycles(@Query('now') now?: string, @Query('count') count?: string) {
    return this.service.produceCycles(now ? new Date(now) : new Date(), Number(count) || 4);
  }

  @Get('produce/cycles/next')
  @RequirePermissions('catalog:read')
  nextProduceCycle(@Query('now') now?: string) {
    return this.service.nextProduceCycle(now ? new Date(now) : new Date());
  }
}
