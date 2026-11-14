import { Injectable } from '@nestjs/common';

@Injectable()
export class CreditLimitsService {
  list(): unknown[] { return []; } // TODO(agent): read from the accounts schema
}
