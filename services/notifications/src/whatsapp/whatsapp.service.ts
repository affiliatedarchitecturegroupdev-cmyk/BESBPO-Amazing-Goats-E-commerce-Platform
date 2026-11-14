import { Injectable } from '@nestjs/common';

@Injectable()
export class WhatsappService {
  list(): unknown[] { return []; } // TODO(agent): read from the notifications schema
}
