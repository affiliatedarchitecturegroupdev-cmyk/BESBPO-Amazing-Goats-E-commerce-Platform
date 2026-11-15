import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { RequirePermissions, userFromRequest } from '@ag/nest-auth';
import { CreditLimitsService } from './credit-limits.service';
import type { CreditProposal } from './credit-approval.rules';
import type { TierInput } from './tiering';

interface ProposeBody {
  input: TierInput;
}

interface RejectBody {
  reason: string;
}

/** The caller's user id, so a proposal records who asked and approvals enforce four-eyes. */
function callerId(req: unknown): string {
  return userFromRequest(req)?.id ?? '';
}

@Controller('accounts/credit-limits')
export class CreditLimitsController {
  constructor(private readonly service: CreditLimitsService) {}

  @Get()
  @RequirePermissions('credit:read')
  list(): Promise<CreditProposal[]> {
    return this.service.list();
  }

  @Get(':orgId')
  @RequirePermissions('credit:read')
  get(@Param('orgId') orgId: string): Promise<CreditProposal> {
    return this.service.get(orgId);
  }

  /** The system proposes a tier and limit; nothing is in force until approved. */
  @Post(':orgId/propose')
  @RequirePermissions('credit:write')
  propose(@Param('orgId') orgId: string, @Body() body: ProposeBody, @Req() req: unknown): Promise<CreditProposal> {
    return this.service.propose(orgId, body.input, callerId(req));
  }

  /** First approval. A limit above the threshold stays proposed until a second. */
  @Post(':orgId/approve')
  @RequirePermissions('credit:approve')
  approve(@Param('orgId') orgId: string, @Req() req: unknown): Promise<CreditProposal> {
    return this.service.approve(orgId, callerId(req));
  }

  /** Second approval for a large limit; the approver must differ from the first. */
  @Post(':orgId/second-approval')
  @RequirePermissions('credit:approve')
  secondApproval(@Param('orgId') orgId: string, @Req() req: unknown): Promise<CreditProposal> {
    return this.service.secondApproval(orgId, callerId(req));
  }

  @Post(':orgId/reject')
  @RequirePermissions('credit:approve')
  reject(@Param('orgId') orgId: string, @Body() body: RejectBody, @Req() req: unknown): Promise<CreditProposal> {
    return this.service.reject(orgId, callerId(req), body.reason);
  }
}
