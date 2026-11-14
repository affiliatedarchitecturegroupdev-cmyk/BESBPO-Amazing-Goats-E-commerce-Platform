import { Injectable } from '@nestjs/common';

@Injectable()
export class PromotionsService {
  list(): unknown[] { return []; } // TODO(agent): read from the commerce schema
}
