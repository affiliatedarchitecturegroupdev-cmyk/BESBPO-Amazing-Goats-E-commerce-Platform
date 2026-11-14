import { Injectable } from '@nestjs/common';

@Injectable()
export class CreditApplicationsService {
  list(): unknown[] { return []; } // TODO(agent): read from the accounts schema
}
