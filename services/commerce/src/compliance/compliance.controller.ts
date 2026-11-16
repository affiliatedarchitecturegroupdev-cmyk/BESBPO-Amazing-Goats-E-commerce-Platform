import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { ComplianceService } from './compliance.service';
import { LabelCompliance } from './label';

@Controller('commerce/compliance')
export class ComplianceController {
  constructor(private readonly service: ComplianceService) {}

  @Get('labels/incomplete')
  @RequirePermissions('catalog:read')
  incomplete() {
    return this.service.incompleteLabels();
  }

  @Get('labels/:sku')
  @RequirePermissions('catalog:read')
  label(@Param('sku') sku: string, @Query('asOf') asOf?: string) {
    return this.service.labelPreview(sku, asOf ? { asOf: new Date(asOf) } : {});
  }

  @Get(':sku')
  @RequirePermissions('catalog:read')
  get(@Param('sku') sku: string) {
    return this.service.get(sku);
  }

  /** Set the class/grade, packer or pack station a rule set needs. */
  @Patch(':sku')
  @RequirePermissions('catalog:write')
  set(@Param('sku') sku: string, @Body() fields: Partial<Omit<LabelCompliance, 'ruleSet'>>) {
    return this.service.set(sku, fields);
  }
}
