import { Channel, TemplateDefinition, TemplateValue, renderTemplate } from './template';

/**
 * Format integer cents as rands. Uses a plain space as the thousands separator
 * (not a non-breaking space) so the copy is stable in an SMS and in a test.
 */
export function formatZar(cents: number): string {
  const negative = cents < 0;
  const whole = Math.abs(Math.round(cents)) / 100;
  const [rand, frac] = whole.toFixed(2).split('.');
  const grouped = rand.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${negative ? '-' : ''}R${grouped}.${frac}`;
}

/** A UTC date and time rendered in Africa/Johannesburg (UTC+2 all year). */
export function formatJohannesburg(at: string | Date): string {
  const date = typeof at === 'string' ? new Date(at) : at;
  const shifted = new Date(date.getTime() + 2 * 60 * 60 * 1000);
  const [day, time] = shifted.toISOString().split('T');
  return `${day} ${time.slice(0, 5)} SAST`;
}

export interface OrderLine {
  name: string;
  qty: number;
}

export interface OrderConfirmationData {
  customerName: string;
  orderNumber: string;
  orderLines: OrderLine[];
  totalIncVatCents: number;
  cycleDeliveryDate: string;
  deliveryAddress: string;
}

export interface CutoffReminderData {
  customerName: string;
  orderNumber: string;
  cutoffAt: string;
  /** Whether this is the 24-hour or the 4-hour reminder from the cycle rules. */
  window: '24h' | '4h';
}

export interface DeliveryData {
  customerName: string;
  orderNumber: string;
  deliveryDate: string;
  /** A two-hour window, e.g. "08:00 to 10:00". */
  deliveryWindow: string;
  trackingUrl: string;
}

export type TemplateKey = 'order_confirmation' | 'cutoff_reminder' | 'delivery_scheduled';

/** Every customer-facing template. Transactional: not marketing, so no opt-in. */
export const TEMPLATES: Record<TemplateKey, TemplateDefinition> = {
  order_confirmation: {
    key: 'order_confirmation',
    kind: 'transactional',
    channels: ['email', 'whatsapp'],
    subject: 'Order {{orderNumber}} confirmed',
    body:
      'Hi {{customerName}},\n\n' +
      'Thank you for your order {{orderNumber}}.\n\n' +
      '{{orderLines}}\n\n' +
      'Total (incl VAT): {{totalIncVat}}\n' +
      'Delivery to: {{deliveryAddress}}\n' +
      'Cycle delivery date: {{cycleDeliveryDate}}\n\n' +
      'Ezimbuzini',
  },
  cutoff_reminder: {
    key: 'cutoff_reminder',
    kind: 'transactional',
    channels: ['email', 'whatsapp', 'sms'],
    subject: 'Reminder: order {{orderNumber}} closes soon',
    body:
      'Hi {{customerName}}, your order {{orderNumber}} closes at {{cutoffAt}} ' +
      '({{window}} reminder). Add or change items before then.',
  },
  delivery_scheduled: {
    key: 'delivery_scheduled',
    kind: 'transactional',
    channels: ['email', 'whatsapp', 'sms'],
    subject: 'Order {{orderNumber}} is out for delivery',
    body:
      'Hi {{customerName}}, order {{orderNumber}} arrives {{deliveryDate}} ' +
      'between {{deliveryWindow}}. Track it: {{trackingUrl}}',
  },
};

/** Build the placeholder values an order confirmation needs, money formatted. */
export function orderConfirmationValues(
  data: OrderConfirmationData,
): Record<string, TemplateValue> {
  const orderLines = data.orderLines.map((line) => `- ${line.qty} x ${line.name}`).join('\n');
  return {
    customerName: data.customerName,
    orderNumber: data.orderNumber,
    orderLines,
    totalIncVat: formatZar(data.totalIncVatCents),
    cycleDeliveryDate: formatJohannesburg(data.cycleDeliveryDate),
    deliveryAddress: data.deliveryAddress,
  };
}

export function cutoffReminderValues(data: CutoffReminderData): Record<string, TemplateValue> {
  return {
    customerName: data.customerName,
    orderNumber: data.orderNumber,
    cutoffAt: formatJohannesburg(data.cutoffAt),
    window: data.window,
  };
}

export function deliveryValues(data: DeliveryData): Record<string, TemplateValue> {
  return {
    customerName: data.customerName,
    orderNumber: data.orderNumber,
    deliveryDate: formatJohannesburg(data.deliveryDate),
    deliveryWindow: data.deliveryWindow,
    trackingUrl: data.trackingUrl,
  };
}

/** Render one of the built-in templates for a channel. */
export function renderMessage(
  key: TemplateKey,
  channel: Channel,
  values: Record<string, TemplateValue>,
) {
  return renderTemplate(TEMPLATES[key], channel, values);
}
