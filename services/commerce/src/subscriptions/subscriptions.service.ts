import { Injectable } from '@nestjs/common';

@Injectable()
export class SubscriptionsService {
  list(): unknown[] { return []; } // TODO(agent): read from the commerce schema
}
