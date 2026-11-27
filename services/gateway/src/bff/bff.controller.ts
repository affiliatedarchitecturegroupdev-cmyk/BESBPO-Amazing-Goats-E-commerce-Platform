import { Controller, Get, Inject, Optional, Query, Req } from '@nestjs/common';
import { AUTH_OPTIONS, AuthOptions, RequirePermissions, userFromRequest } from '@ag/nest-auth';
import { BffService, viewForRoles } from './bff.service';
import { ViewChannel, merchPageFrom } from './upstream';

/**
 * Storefront/trade BFF. The catalogue routes are public so the shop can be
 * browsed before signing in (T-082); the catalogue view (public vs trade) still
 * follows the caller's roles, and the caller's bearer token is forwarded to the
 * upstream services. Everything that is not a catalogue read stays
 * permission-gated.
 */
@Controller('gateway/bff')
export class BffController {
  constructor(
    private readonly service: BffService,
    @Optional() @Inject(AUTH_OPTIONS) private readonly options: AuthOptions = {},
  ) {}

  @Get('home')
  home(@Req() req: any) {
    return this.service.home(this.view(req), authorization(req));
  }

  @Get('merchandising')
  merchandising(@Req() req: any, @Query() q: Record<string, unknown>) {
    return this.service.merchandising(merchPageFrom(q.page), this.view(req), authorization(req));
  }

  @Get('catalogue')
  catalogue(@Req() req: any) {
    return this.service.catalogue(this.view(req), authorization(req));
  }

  @Get('openapi')
  @RequirePermissions('catalog:read')
  openapi() {
    return this.service.openapi();
  }

  /** `userFromRequest` needs the same options the guard uses, or a token is not read. */
  private view(req: any): ViewChannel {
    return viewForRoles(userFromRequest(req, this.options)?.roles ?? []);
  }
}

function authorization(req: any): string | undefined {
  const v = req?.headers?.authorization;
  return typeof v === 'string' ? v : undefined;
}
