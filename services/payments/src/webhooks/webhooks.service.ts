import { Injectable } from '@nestjs/common';

@Injectable()
export class WebhooksService {
  list(): unknown[] { return []; } // TODO(agent): read from the payments schema
}
