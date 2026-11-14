import { DispatchService, SendInput } from './dispatch.service';
import { DispatchRecord, Recipient } from './dispatch';
import { TEMPLATES, TemplateKey } from '../templates/catalogue';
import type { Channel, TemplateValue } from '../templates/template';
import { renderTemplate } from '../templates/template';

export interface SendTemplateInput {
  templateKey: TemplateKey;
  recipient: Recipient;
  values: Record<string, TemplateValue>;
  /** Defaults to the template's own kind; override only for a test or a preview. */
  kind?: 'transactional' | 'marketing';
}

/** Render a built-in template for one channel and hand it to dispatch. */
export function sendTemplate(
  dispatch: DispatchService,
  channel: Channel,
  input: SendTemplateInput,
): Promise<DispatchRecord> {
  const definition = TEMPLATES[input.templateKey];
  const message = renderTemplate(definition, channel, input.values);
  const send: SendInput = {
    channel,
    templateKey: input.templateKey,
    kind: input.kind ?? definition.kind,
    recipient: input.recipient,
    message,
  };
  return dispatch.send(send);
}
