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
import { DeliveryWebhookService } from './webhook.service';
import type { WebhookResult } from './webhook.service';
import type { DeliveryRecord, SuppressionEntry } from './delivery';
import { DeliveryService } from './delivery.service';

/** Minimal shape of the raw request Nest attaches when `rawBody` is enabled. */
interface RawBodyRequest {
  rawBody?: Buffer;
}

@Controller('notifications/delivery')
export class DeliveryController {
  constructor(
    private readonly service: DeliveryService,
    private readonly webhook: DeliveryWebhookService,
  ) {}

  /**
   * Resend's callback. No auth guard: the provider authenticates with its
   * signature, which is verified over the exact bytes it signed. `rawBody` is
   * enabled in `main.ts` so the HMAC matches even when JSON key order or
   * whitespace differs.
   */
  @Post('resend')
  receive(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() request: RawBodyRequest,
    @Body() body: unknown,
  ): Promise<WebhookResult> {
    const rawBody =
      request.rawBody?.toString('utf8') ?? (typeof body === 'string' ? body : JSON.stringify(body));
    if (!rawBody) throw new BadRequestException('empty body');
    return this.webhook.receive({ headers, rawBody });
  }

  @Get('email/:providerRef')
  @RequirePermissions('support:manage')
  forMessage(@Param('providerRef') providerRef: string): Promise<DeliveryRecord[]> {
    return this.service.forMessage(providerRef);
  }

  @Get('suppressed')
  @RequirePermissions('support:manage')
  suppressed(): Promise<SuppressionEntry[]> {
    return this.service.suppressed();
  }
}
