import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { RequirePermissions, userFromRequest } from '@ag/nest-auth';
import { CreativesService } from './creatives.service';
import type { Creative, CreativeInput } from '../campaigns/campaign-rules';

interface ReviewBody {
  decision: 'approved' | 'rejected';
  notes?: string;
}

function callerId(req: unknown): string {
  return userFromRequest(req)?.id ?? '';
}

/** Campaign creatives and the review queue. Every route stays behind RBAC. */
@Controller('ads/creatives')
export class CreativesController {
  constructor(private readonly service: CreativesService) {}

  @Get()
  @RequirePermissions('ads:manage')
  list(@Query('campaignId') campaignId?: string): Promise<Creative[]> {
    return this.service.list(campaignId);
  }

  /** The review queue: creatives still pending a decision. */
  @Get('review-queue')
  @RequirePermissions('ads:approve')
  pending(): Promise<Creative[]> {
    return this.service.pending();
  }

  @Get(':id')
  @RequirePermissions('ads:manage')
  get(@Param('id') id: string): Promise<Creative> {
    return this.service.get(id);
  }

  @Post()
  @RequirePermissions('ads:manage')
  draft(@Body() body: CreativeInput): Promise<Creative> {
    return this.service.draft(body);
  }

  /** Human review: only `ads:approve` may decide a creative. */
  @Post(':id/review')
  @RequirePermissions('ads:approve')
  review(@Param('id') id: string, @Body() body: ReviewBody, @Req() req: unknown): Promise<Creative> {
    return this.service.review(id, callerId(req), body.decision, body.notes);
  }
}
