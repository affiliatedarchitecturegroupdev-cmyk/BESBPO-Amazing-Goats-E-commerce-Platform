import { Injectable } from '@nestjs/common';

@Injectable()
export class RolesService {
  list(): unknown[] { return []; } // TODO(agent): read from the identity schema
}
