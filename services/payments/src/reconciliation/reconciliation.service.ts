import { Injectable } from '@nestjs/common';

@Injectable()
export class ReconciliationService {
  list(): unknown[] { return []; } // TODO(agent): read from the payments schema
}
