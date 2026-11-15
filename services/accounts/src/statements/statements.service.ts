import { Inject, Injectable } from '@nestjs/common';
import { InvoicesStore } from '../invoices/invoices.store';
import { buildStatement, Statement } from './statement.rules';

export const STATEMENTS_INVOICES_STORE = Symbol('STATEMENTS_INVOICES_STORE');

/**
 * Statements. Derived from the org's invoices through the pure `buildStatement`
 * rule, so the ageing and the balance have one definition.
 */
@Injectable()
export class StatementsService {
  constructor(@Inject(STATEMENTS_INVOICES_STORE) private readonly invoices: InvoicesStore) {}

  async forOrg(orgId: string, asOf: string): Promise<Statement> {
    return buildStatement(orgId, await this.invoices.all(), asOf);
  }
}
