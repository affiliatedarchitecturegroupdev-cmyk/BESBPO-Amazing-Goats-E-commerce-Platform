import { Injectable } from '@nestjs/common';

@Injectable()
export class ZonesService {
  list(): unknown[] { return []; } // TODO(agent): read from the logistics schema
}
