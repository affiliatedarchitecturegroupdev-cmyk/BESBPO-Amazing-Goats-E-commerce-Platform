import { Injectable } from '@nestjs/common';

@Injectable()
export class SmsService {
  list(): unknown[] { return []; } // TODO(agent): read from the notifications schema
}
