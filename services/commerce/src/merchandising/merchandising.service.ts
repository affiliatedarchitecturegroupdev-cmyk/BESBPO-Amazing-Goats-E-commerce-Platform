import { Injectable } from '@nestjs/common';

@Injectable()
export class MerchandisingService {
  list(): unknown[] { return []; } // TODO(agent): read from the commerce schema
}
