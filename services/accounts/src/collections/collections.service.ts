import { Injectable } from '@nestjs/common';

@Injectable()
export class CollectionsService {
  list(): unknown[] { return []; } // TODO(agent): read from the accounts schema
}
