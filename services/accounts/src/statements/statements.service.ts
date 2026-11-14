import { Injectable } from '@nestjs/common';

@Injectable()
export class StatementsService {
  list(): unknown[] { return []; } // TODO(agent): read from the accounts schema
}
