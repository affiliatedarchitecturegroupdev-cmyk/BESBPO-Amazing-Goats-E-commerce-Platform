import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { WebhooksService } from './webhooks.service';
import type { WebhookResult } from './webhooks.service';
import type { ProviderEventRecord } from './webhooks.store';
import type { Provider } from '../routing/route-payment';

/** Minimal shape of the raw request Nest attaches when `rawBody` is enabled. */
interface RawBodyRequest {
  rawBody?: Buffer;
}

@Controller('payments/webhooks')
export class WebhooksController {
  constructor(private readonly service: WebhooksService) {}

  @Get()
  @RequirePermissions('payments:read')
  list(): ProviderEventRecord[] {
    return this.service.list();
  }

  /**
   * Provider callback. No auth guard: the provider authenticates with its
   * signature, which the adapter verifies over the raw body. The exact bytes are
   * preferred (`rawBody`, enabled in `main.ts`) so the HMAC matches what the
   * provider signed even when JSON key order or whitespace differs.
   */
  @Post(':provider')
  receive(
    @Param('provider') provider: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() request: RawBodyRequest,
    @Body() body: unknown,
  ): WebhookResult {
    const rawBody =
      request.rawBody?.toString('utf8') ?? (typeof body === 'string' ? body : JSON.stringify(body));
    if (!rawBody) throw new BadRequestException('empty body');
    return this.service.receive(provider as Provider, { headers, rawBody });
  }
}
