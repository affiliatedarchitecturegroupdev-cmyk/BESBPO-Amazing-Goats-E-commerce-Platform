import { Injectable } from '@nestjs/common';
import { DispatchService } from '../dispatch/dispatch.service';
import { sendTemplate, SendTemplateInput } from '../dispatch/send-template';
import type { DispatchRecord } from '../dispatch/dispatch';

@Injectable()
export class EmailService {
  constructor(private readonly dispatch: DispatchService) {}

  list(): DispatchRecord[] {
    return this.dispatch.list().filter((entry) => entry.channel === 'email');
  }

  /** Renders the template and sends over email, subject to consent. */
  send(input: SendTemplateInput): Promise<DispatchRecord> {
    return sendTemplate(this.dispatch, 'email', input);
  }
}
