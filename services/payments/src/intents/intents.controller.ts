import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { IntentsService } from './intents.service';
import type { Method } from '../routing/route-payment';
import type { PaymentIntent } from '../providers/payment-intent';

interface CreateIntentBody {
  idempotencyKey: string;
  method: Method;
  amountIncVatCents: number;
  orderId?: string;
  invoiceId?: string;
  reference?: string;
  returnUrl?: string;
  notifyUrl?: string;
}

@Controller('payments/intents')
export class IntentsController {
  constructor(private readonly service: IntentsService) {}

  @Get()
  @RequirePermissions('payments:read')
  list(): Promise<PaymentIntent[]> {
    return this.service.list();
  }

  @Get(':id')
  @RequirePermissions('payments:read')
  get(@Param('id') id: string): Promise<PaymentIntent> {
    return this.service.get(id);
  }

  @Post()
  @RequirePermissions('orders:write')
  create(@Body() body: CreateIntentBody): Promise<PaymentIntent> {
    return this.service.create(body);
  }
}
