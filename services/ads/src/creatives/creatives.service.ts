import { Injectable } from '@nestjs/common';

@Injectable()
export class CreativesService {
  list(): unknown[] { return []; } // TODO(agent): read from the ads schema
}
