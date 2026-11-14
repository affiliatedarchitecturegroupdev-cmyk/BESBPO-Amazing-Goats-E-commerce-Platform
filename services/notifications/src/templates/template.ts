/**
 * Template rendering. A message is a subject (email only) and a body, both
 * holding `{{key}}` placeholders. Rendering is pure so the copy can be tested
 * without sending anything: sending a message to a real person is a gated path
 * (see AGENTS.md, "anything that sends email, WhatsApp or SMS to real people").
 */

export type Channel = 'email' | 'whatsapp' | 'sms';

/** A value that can appear in a placeholder. */
export type TemplateValue = string | number;

export interface Message {
  channel: Channel;
  /** Present for email; omitted for WhatsApp and SMS. */
  subject?: string;
  body: string;
}

export interface TemplateDefinition {
  /** Machine name, e.g. `order_confirmation`. */
  key: string;
  /** Which message classes may use it; a marketing template is opt-in only. */
  kind: 'transactional' | 'marketing';
  channels: Channel[];
  subject?: string;
  body: string;
}

export class MissingPlaceholderError extends Error {
  constructor(key: string) {
    super(`no value supplied for placeholder {{${key}}}`);
    this.name = 'MissingPlaceholderError';
  }
}

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** The placeholder names a template string uses, de-duplicated in first-seen order. */
export function placeholdersIn(template: string): string[] {
  const seen = new Set<string>();
  for (const match of template.matchAll(PLACEHOLDER)) seen.add(match[1]);
  return [...seen];
}

/**
 * Substitutes every `{{key}}`. A missing value throws rather than rendering an
 * empty string, because a customer must never receive "Hi , your order ...".
 * Values are coerced to string; an email or phone number is never logged here.
 */
export function render(template: string, values: Record<string, TemplateValue>): string {
  return template.replace(PLACEHOLDER, (_match, key: string) => {
    const value = values[key];
    if (value === undefined || value === null) throw new MissingPlaceholderError(key);
    return String(value);
  });
}

/** Renders a whole definition into a channel-specific message. */
export function renderTemplate(
  definition: TemplateDefinition,
  channel: Channel,
  values: Record<string, TemplateValue>,
): Message {
  if (!definition.channels.includes(channel)) {
    throw new Error(`template ${definition.key} does not support the ${channel} channel`);
  }
  const message: Message = { channel, body: render(definition.body, values) };
  if (channel === 'email' && definition.subject)
    message.subject = render(definition.subject, values);
  return message;
}

/** Every placeholder a definition needs across its subject and body. */
export function requiredValues(definition: TemplateDefinition): string[] {
  const names = new Set<string>();
  if (definition.subject) for (const name of placeholdersIn(definition.subject)) names.add(name);
  for (const name of placeholdersIn(definition.body)) names.add(name);
  return [...names];
}
