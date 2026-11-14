import { Injectable } from '@nestjs/common';

@Injectable()
export class EmailService {
  list(): unknown[] { return []; } // TODO(agent): read from the notifications schema
}
