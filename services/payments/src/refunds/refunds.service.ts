import { Injectable } from '@nestjs/common';

@Injectable()
export class RefundsService {
  list(): unknown[] { return []; } // TODO(agent): read from the payments schema
}
