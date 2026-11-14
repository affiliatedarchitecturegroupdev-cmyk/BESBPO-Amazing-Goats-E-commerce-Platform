import { Injectable } from '@nestjs/common';

@Injectable()
export class DriverSyncService {
  list(): unknown[] { return []; } // TODO(agent): read from the logistics schema
}
