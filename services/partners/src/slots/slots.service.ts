import { Injectable } from '@nestjs/common';

@Injectable()
export class SlotsService {
  list(): unknown[] { return []; } // TODO(agent): read from the partners schema
}
