import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { ProofOfDeliveryService } from './proof-of-delivery.service';

// TODO(agent): implement per tasks/ backlog. Keep every route behind RequirePermissions.
@Controller('logistics/proof-of-delivery')
export class ProofOfDeliveryController {
  constructor(private readonly service: ProofOfDeliveryService) {}

  @Get()
  @RequirePermissions('delivery:execute')
  list() { return this.service.list(); }
}
