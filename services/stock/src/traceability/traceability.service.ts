import { Injectable } from '@nestjs/common';

@Injectable()
export class TraceabilityService {
  list(): unknown[] { return []; } // TODO(agent): read from the stock schema
}
