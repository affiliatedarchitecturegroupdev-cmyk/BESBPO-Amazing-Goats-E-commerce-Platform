import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { RequirePermissions, userFromRequest } from '@ag/nest-auth';
import { CreditApplicationsService } from './credit-applications.service';
import type { ApplicationInput, CreditApplication } from './credit-application.rules';

interface RejectBody {
  reason: string;
}

/** The caller's user id, so an application records who decided and four-eyes holds. */
function callerId(req: unknown): string {
  return userFromRequest(req)?.id ?? '';
}

@Controller('accounts/credit-applications')
export class CreditApplicationsController {
  constructor(private readonly service: CreditApplicationsService) {}

  @Get()
  @RequirePermissions('credit:read')
  list(): Promise<CreditApplication[]> {
    return this.service.list();
  }

  @Get(':id')
  @RequirePermissions('credit:read')
  get(@Param('id') id: string): Promise<CreditApplication> {
    return this.service.get(id);
  }

  /** A trade applicant submits; the route is behind `credit:write`. */
  @Post()
  @RequirePermissions('credit:write')
  submit(@Body() body: ApplicationInput): Promise<CreditApplication> {
    return this.service.submit(body);
  }

  /** First approval. A limit above the threshold stays submitted until a second. */
  @Post(':id/approve')
  @RequirePermissions('credit:approve')
  approve(@Param('id') id: string, @Req() req: unknown): Promise<CreditApplication> {
    return this.service.approve(id, callerId(req));
  }

  /** Second approval for a large limit; the approver must differ from the first. */
  @Post(':id/second-approval')
  @RequirePermissions('credit:approve')
  secondApproval(@Param('id') id: string, @Req() req: unknown): Promise<CreditApplication> {
    return this.service.secondApproval(id, callerId(req));
  }

  @Post(':id/reject')
  @RequirePermissions('credit:approve')
  reject(@Param('id') id: string, @Body() body: RejectBody, @Req() req: unknown): Promise<CreditApplication> {
    return this.service.reject(id, callerId(req), body.reason);
  }
}
