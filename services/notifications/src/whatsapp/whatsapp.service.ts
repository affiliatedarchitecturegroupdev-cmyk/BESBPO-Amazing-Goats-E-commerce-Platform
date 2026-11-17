import { Injectable } from '@nestjs/common';
import { DispatchService } from '../dispatch/dispatch.service';
import { sendTemplate, SendTemplateInput } from '../dispatch/send-template';
import type { DispatchRecord } from '../dispatch/dispatch';

@Injectable()
export class WhatsappService {
  constructor(private readonly dispatch: DispatchService) {}

  async list(): Promise<DispatchRecord[]> {
    const entries = await this.dispatch.list();
    return entries.filter((entry) => entry.channel === 'whatsapp');
  }

  /** Renders the template and sends over WhatsApp, subject to consent. */
  send(input: SendTemplateInput): Promise<DispatchRecord> {
    return sendTemplate(this.dispatch, 'whatsapp', input);
  }
}
