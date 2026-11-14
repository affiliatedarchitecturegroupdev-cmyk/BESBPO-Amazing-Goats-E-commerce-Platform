import { Injectable } from '@nestjs/common';

@Injectable()
export class DocumentsService {
  list(): unknown[] { return []; } // TODO(agent): read from the partners schema
}
