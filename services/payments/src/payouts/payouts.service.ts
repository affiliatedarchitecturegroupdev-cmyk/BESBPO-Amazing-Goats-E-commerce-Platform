import { Injectable } from '@nestjs/common';

@Injectable()
export class PayoutsService {
  list(): unknown[] { return []; } // TODO(agent): read from the payments schema
}
