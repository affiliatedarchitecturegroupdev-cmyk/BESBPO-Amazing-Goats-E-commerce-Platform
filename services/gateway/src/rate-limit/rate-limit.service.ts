import { Injectable } from '@nestjs/common';

@Injectable()
export class RateLimitService {
  list(): unknown[] { return []; } // TODO(agent): read from the gateway schema
}
