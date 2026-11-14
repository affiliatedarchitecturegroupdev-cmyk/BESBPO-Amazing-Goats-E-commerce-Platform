import { Injectable } from '@nestjs/common';

@Injectable()
export class BatchesService {
  list(): unknown[] { return []; } // TODO(agent): read from the stock schema
}
