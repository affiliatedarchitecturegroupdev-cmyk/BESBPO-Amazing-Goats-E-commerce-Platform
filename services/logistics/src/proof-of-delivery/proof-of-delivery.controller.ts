import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RequireAuthenticated, RequirePermissions } from '@ag/nest-auth';
import { ProofOfDeliveryService } from './proof-of-delivery.service';
import { CaptureInput, ProofOfDelivery } from './proof-of-delivery.types';

/**
 * Proof of delivery (T-065). A driver captures proof at the stop, so the write
 * and the full list are behind `delivery:execute`.
 *
 * A customer reading the proof of their own delivery uses `GET stops/:stopId`:
 * it requires a signed-in caller and no particular permission, and row-level
 * security decides whether the row is theirs. A customer has no
 * `delivery:execute` and must not be given one just to see their own drop.
 */
@Controller('logistics/proof-of-delivery')
export class ProofOfDeliveryController {
  constructor(private readonly service: ProofOfDeliveryService) {}

  @Get()
  @RequirePermissions('delivery:execute')
  list(): Promise<ProofOfDelivery[]> {
    return this.service.list();
  }

  @Post('stops/:stopId')
  @RequirePermissions('delivery:execute')
  capture(@Param('stopId') stopId: string, @Body() body: CaptureInput): Promise<ProofOfDelivery> {
    return this.service.capture(stopId, body ?? {});
  }

  @Get('stops/:stopId')
  @RequireAuthenticated()
  get(@Param('stopId') stopId: string): Promise<ProofOfDelivery> {
    return this.service.get(stopId);
  }
}
