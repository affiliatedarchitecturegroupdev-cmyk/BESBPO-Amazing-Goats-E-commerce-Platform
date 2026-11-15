import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { ChargebacksService } from './chargebacks.service';
import { Chargeback } from './chargebacks.types';

interface ReceiveChargebackBody {
  id: string;
  paymentId: string;
  payoutId: string;
  provider: string;
  amountCents: number;
  reason: string;
}

@Controller('payments/chargebacks')
export class ChargebacksController {
  constructor(private readonly service: ChargebacksService) {}

  @Get()
  @RequirePermissions('payments:reconcile')
  list(): Promise<Chargeback[]> {
    return this.service.list();
  }

  @Get(':id')
  @RequirePermissions('payments:reconcile')
  get(@Param('id') id: string): Promise<Chargeback> {
    return this.service.get(id);
  }

  /** Record a chargeback; the related payout is frozen before the money leaves. */
  @Post()
  @RequirePermissions('payments:reconcile')
  receive(@Body() body: ReceiveChargebackBody): Promise<Chargeback> {
    return this.service.receive(body);
  }
}
