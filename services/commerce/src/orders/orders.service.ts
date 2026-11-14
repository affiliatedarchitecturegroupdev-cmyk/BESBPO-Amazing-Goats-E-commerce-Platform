import { Injectable } from '@nestjs/common';

@Injectable()
export class OrdersService {
  list(): unknown[] { return []; } // TODO(agent): read from the commerce schema
}
