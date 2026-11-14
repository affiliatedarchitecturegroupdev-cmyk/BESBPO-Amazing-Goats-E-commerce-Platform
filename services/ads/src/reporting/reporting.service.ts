import { Injectable } from '@nestjs/common';

@Injectable()
export class ReportingService {
  list(): unknown[] { return []; } // TODO(agent): read from the ads schema
}
