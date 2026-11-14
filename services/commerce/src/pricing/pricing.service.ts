import { Injectable } from '@nestjs/common';

@Injectable()
export class PricingService {
  list(): unknown[] { return []; } // TODO(agent): read from the commerce schema
}
