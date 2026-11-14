import { Injectable } from '@nestjs/common';

@Injectable()
export class ProvidersService {
  list(): unknown[] { return []; } // TODO(agent): read from the payments schema
}
