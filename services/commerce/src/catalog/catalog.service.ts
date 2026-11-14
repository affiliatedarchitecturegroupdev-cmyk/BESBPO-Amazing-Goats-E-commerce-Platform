import { Injectable } from '@nestjs/common';

@Injectable()
export class CatalogService {
  list(): unknown[] { return []; } // TODO(agent): read from the commerce schema
}
