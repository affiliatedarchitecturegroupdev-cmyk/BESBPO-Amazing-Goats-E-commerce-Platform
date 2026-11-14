import { Injectable } from '@nestjs/common';

@Injectable()
export class InvoicesService {
  list(): unknown[] { return []; } // TODO(agent): read from the accounts schema
}
