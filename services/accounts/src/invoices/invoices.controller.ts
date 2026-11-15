import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { InvoicesService, CreateInvoiceInput } from './invoices.service';
import { Invoice } from './invoices.types';

@Controller('accounts/invoices')
export class InvoicesController {
  constructor(private readonly service: InvoicesService) {}

  @Get()
  @RequirePermissions('invoices:read')
  list(): Promise<Invoice[]> {
    return this.service.list();
  }

  @Get(':id')
  @RequirePermissions('invoices:read')
  get(@Param('id') id: string): Promise<Invoice> {
    return this.service.get(id);
  }

  @Post()
  @RequirePermissions('invoices:write')
  create(@Body() body: CreateInvoiceInput): Promise<Invoice> {
    return this.service.create(body);
  }

  @Post(':id/paid')
  @RequirePermissions('invoices:write')
  markPaid(@Param('id') id: string): Promise<Invoice> {
    return this.service.markPaid(id);
  }
}
