import { Injectable } from '@nestjs/common';
import { DispatchService } from '../dispatch/dispatch.service';
import { sendTemplate, SendTemplateInput } from '../dispatch/send-template';
import type { DispatchRecord } from '../dispatch/dispatch';

@Injectable()
export class SmsService {
  constructor(private readonly dispatch: DispatchService) {}

  list(): DispatchRecord[] {
    return this.dispatch.list().filter((entry) => entry.channel === 'sms');
  }

  /** Renders the template and sends over SMS, subject to consent. */
  send(input: SendTemplateInput): Promise<DispatchRecord> {
    return sendTemplate(this.dispatch, 'sms', input);
  }
}
