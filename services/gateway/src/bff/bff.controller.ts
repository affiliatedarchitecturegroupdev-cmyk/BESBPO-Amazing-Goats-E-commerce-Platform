import { Controller, Get, Query, Req } from '@nestjs/common';
import { RequirePermissions, userFromRequest } from '@ag/nest-auth';
import { BffService, viewForRoles } from './bff.service';
import { ViewChannel, merchPageFrom } from './upstream';

/**
 * Storefront/trade BFF. Every route is permission-gated; the catalogue view
 * (public vs trade) follows the caller's roles, and the caller's bearer token
 * is forwarded to the upstream services.
 */
@Controller('gateway/bff')
export class BffController {
  constructor(private readonly service: BffService) {}

  @Get('home')
  @RequirePermissions('catalog:read')
  home(@Req() req: any) {
    return this.service.home(view(req), authorization(req));
  }

  @Get('merchandising')
  @RequirePermissions('catalog:read')
  merchandising(@Req() req: any, @Query() q: Record<string, unknown>) {
    return this.service.merchandising(merchPageFrom(q.page), view(req), authorization(req));
  }

  @Get('catalogue')
  @RequirePermissions('catalog:read')
  catalogue(@Req() req: any) {
    return this.service.catalogue(view(req), authorization(req));
  }

  @Get('openapi')
  @RequirePermissions('catalog:read')
  openapi() {
    return this.service.openapi();
  }
}

function view(req: any): ViewChannel {
  return viewForRoles(userFromRequest(req)?.roles ?? []);
}

function authorization(req: any): string | undefined {
  const v = req?.headers?.authorization;
  return typeof v === 'string' ? v : undefined;
}
