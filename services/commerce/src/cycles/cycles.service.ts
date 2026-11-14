import { Injectable } from '@nestjs/common';

@Injectable()
export class CyclesService {
  list(): unknown[] { return []; } // TODO(agent): read from the commerce schema
}
