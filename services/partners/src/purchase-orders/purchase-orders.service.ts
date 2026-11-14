import { Injectable } from '@nestjs/common';

@Injectable()
export class PurchaseOrdersService {
  list(): unknown[] { return []; } // TODO(agent): read from the partners schema
}
