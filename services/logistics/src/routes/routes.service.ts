import { Injectable } from '@nestjs/common';

@Injectable()
export class RoutesService {
  list(): unknown[] { return []; } // TODO(agent): read from the logistics schema
}
