import { Injectable } from '@nestjs/common';

@Injectable()
export class BillingService {
  list(): unknown[] { return []; } // TODO(agent): read from the ads schema
}
