import { describe, it, expect } from 'vitest';
import {
  TEMPLATES,
  cutoffReminderValues,
  deliveryValues,
  formatJohannesburg,
  formatZar,
  orderConfirmationValues,
  renderMessage,
} from './catalogue';

describe('formatZar', () => {
  it('formats cents as rands with two decimals', () => {
    expect(formatZar(310_500)).toBe('R3 105.00');
    expect(formatZar(150)).toBe('R1.50');
    expect(formatZar(0)).toBe('R0.00');
  });

  it('groups thousands and handles a negative amount', () => {
    expect(formatZar(1_234_567)).toBe('R12 345.67');
    expect(formatZar(-200)).toBe('-R2.00');
  });
});

describe('formatJohannesburg', () => {
  it('renders UTC as SAST (UTC+2)', () => {
    expect(formatJohannesburg('2026-11-15T15:00:00.000Z')).toBe('2026-11-15 17:00 SAST');
  });

  it('rolls over to the next day when the shift crosses midnight', () => {
    expect(formatJohannesburg('2026-11-15T22:30:00.000Z')).toBe('2026-11-16 00:30 SAST');
  });
});

describe('orderConfirmationValues', () => {
  it('formats the total and the cycle date and joins the lines', () => {
    const values = orderConfirmationValues({
      customerName: 'Thabo',
      orderNumber: 'AG-1001',
      orderLines: [
        { name: 'Mixed box', qty: 2 },
        { name: 'Free-range eggs', qty: 1 },
      ],
      totalIncVatCents: 310_500,
      cycleDeliveryDate: '2026-11-18T06:00:00.000Z',
      deliveryAddress: '12 Main Road, Mthatha',
    });
    expect(values.totalIncVat).toBe('R3 105.00');
    expect(values.orderLines).toBe('- 2 x Mixed box\n- 1 x Free-range eggs');
    expect(values.cycleDeliveryDate).toBe('2026-11-18 08:00 SAST');
  });
});

describe('renderMessage', () => {
  it('renders an order confirmation email with a subject', () => {
    const message = renderMessage('order_confirmation', 'email', {
      customerName: 'Thabo',
      orderNumber: 'AG-1001',
      orderLines: '- 2 x Mixed box',
      totalIncVat: 'R3 105.00',
      cycleDeliveryDate: '2026-11-18 08:00 SAST',
      deliveryAddress: '12 Main Road, Mthatha',
    });
    expect(message.subject).toBe('Order AG-1001 confirmed');
    expect(message.body).toContain('Hi Thabo');
    expect(message.body).toContain('R3 105.00');
  });

  it('renders a cut-off reminder on SMS without a subject', () => {
    const values = cutoffReminderValues({
      customerName: 'Thabo',
      orderNumber: 'AG-1001',
      cutoffAt: '2026-11-15T15:00:00.000Z',
      window: '4h',
    });
    const message = renderMessage('cutoff_reminder', 'sms', values);
    expect(message.subject).toBeUndefined();
    expect(message.body).toContain('2026-11-15 17:00 SAST');
    expect(message.body).toContain('4h reminder');
  });

  it('renders a delivery notification with the tracking link', () => {
    const message = renderMessage(
      'delivery_scheduled',
      'whatsapp',
      deliveryValues({
        customerName: 'Thabo',
        orderNumber: 'AG-1001',
        deliveryDate: '2026-11-18T06:00:00.000Z',
        deliveryWindow: '08:00 to 10:00',
        trackingUrl: 'https://ezimbuzini.example/track/AG-1001',
      }),
    );
    expect(message.body).toContain('08:00 to 10:00');
    expect(message.body).toContain('https://ezimbuzini.example/track/AG-1001');
  });

  it('exposes the launch templates', () => {
    expect(Object.keys(TEMPLATES)).toContain('delivery_scheduled');
  });
});
