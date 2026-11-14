import { Injectable } from '@nestjs/common';

@Injectable()
export class AuditService {
  list(): unknown[] { return []; } // TODO(agent): read from the identity schema
}
