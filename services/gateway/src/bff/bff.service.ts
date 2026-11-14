import { Injectable } from '@nestjs/common';

@Injectable()
export class BffService {
  list(): unknown[] { return []; } // TODO(agent): read from the gateway schema
}
