import { Injectable } from '@nestjs/common';

@Injectable()
export class RecallsService {
  list(): unknown[] { return []; } // TODO(agent): read from the stock schema
}
