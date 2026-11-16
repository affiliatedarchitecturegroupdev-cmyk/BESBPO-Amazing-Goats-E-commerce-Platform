import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { RequirePermissions, userFromRequest } from '@ag/nest-auth';
import { CampaignsService } from './campaigns.service';
import type { Campaign, CampaignInput } from './campaign-rules';

interface RejectBody {
  reason: string;
}

/** The caller's user id, so a review records who decided. */
function callerId(req: unknown): string {
  return userFromRequest(req)?.id ?? '';
}

/** Advertiser campaigns and their review. Every route stays behind RBAC. */
@Controller('ads/campaigns')
export class CampaignsController {
  constructor(private readonly service: CampaignsService) {}

  @Get()
  @RequirePermissions('ads:read')
  list(): Promise<Campaign[]> {
    return this.service.list();
  }

  @Get(':id')
  @RequirePermissions('ads:read')
  get(@Param('id') id: string): Promise<Campaign> {
    return this.service.get(id);
  }

  /** An advertiser drafts a campaign; the route is behind `ads:manage`. */
  @Post()
  @RequirePermissions('ads:manage')
  draft(@Body() body: CampaignInput): Promise<Campaign> {
    return this.service.draft(body);
  }

  @Post(':id/submit')
  @RequirePermissions('ads:manage')
  submit(@Param('id') id: string): Promise<Campaign> {
    return this.service.submit(id);
  }

  /** Human review: only `ads:approve` may take a campaign out of review. */
  @Post(':id/approve')
  @RequirePermissions('ads:approve')
  approve(@Param('id') id: string, @Req() req: unknown): Promise<Campaign> {
    return this.service.approve(id, callerId(req));
  }

  @Post(':id/reject')
  @RequirePermissions('ads:approve')
  reject(@Param('id') id: string, @Body() body: RejectBody, @Req() req: unknown): Promise<Campaign> {
    return this.service.reject(id, callerId(req), body.reason);
  }

  @Post(':id/pause')
  @RequirePermissions('ads:manage')
  pause(@Param('id') id: string): Promise<Campaign> {
    return this.service.pause(id);
  }

  @Post(':id/end')
  @RequirePermissions('ads:manage')
  end(@Param('id') id: string): Promise<Campaign> {
    return this.service.end(id);
  }
}
