import { describe, it, expect } from 'vitest';
import {
  MissingPlaceholderError,
  placeholdersIn,
  render,
  renderTemplate,
  requiredValues,
} from './template';
import { TEMPLATES, TemplateKey } from './catalogue';

describe('render', () => {
  it('substitutes every placeholder', () => {
    expect(render('Hi {{name}}, order {{ref}}', { name: 'Thabo', ref: 'A1' })).toBe(
      'Hi Thabo, order A1',
    );
  });

  it('tolerates whitespace inside the braces', () => {
    expect(render('{{  name }}', { name: 'x' })).toBe('x');
  });

  it('throws when a value is missing rather than rendering an empty string', () => {
    expect(() => render('Hi {{name}}', {})).toThrow(MissingPlaceholderError);
  });
});

describe('placeholdersIn / requiredValues', () => {
  it('lists unique placeholder names in first-seen order', () => {
    expect(placeholdersIn('{{a}} {{b}} {{a}}')).toEqual(['a', 'b']);
  });

  it('includes the subject placeholders', () => {
    expect(
      requiredValues({
        key: 'k',
        kind: 'transactional',
        channels: ['email'],
        subject: '{{x}}',
        body: '{{y}}',
      }),
    ).toEqual(['x', 'y']);
  });
});

describe('renderTemplate', () => {
  it('rejects a channel the template does not support', () => {
    expect(() =>
      renderTemplate(
        { key: 'k', kind: 'transactional', channels: ['email'], body: 'x' },
        'sms',
        {},
      ),
    ).toThrow(/does not support the sms channel/);
  });

  it('omits the subject for a non-email channel', () => {
    const message = renderTemplate(
      { key: 'k', kind: 'transactional', channels: ['whatsapp'], subject: 's', body: 'b' },
      'whatsapp',
      {},
    );
    expect(message.subject).toBeUndefined();
  });
});

describe('the built-in catalogue', () => {
  const keys = Object.keys(TEMPLATES) as TemplateKey[];

  it('has the three launch templates', () => {
    expect(keys.sort()).toEqual(['cutoff_reminder', 'delivery_scheduled', 'order_confirmation']);
  });

  it('marks every launch template transactional so it needs no marketing consent', () => {
    for (const key of keys) expect(TEMPLATES[key].kind).toBe('transactional');
  });

  it('renders each template on each of its channels without a missing placeholder', () => {
    const values = {
      customerName: 'A',
      orderNumber: 'B',
      orderLines: '- 1 x Box',
      totalIncVat: 'R1.00',
      cycleDeliveryDate: 'C',
      deliveryAddress: 'D',
      cutoffAt: 'E',
      window: '24h',
      deliveryDate: 'F',
      deliveryWindow: 'G',
      trackingUrl: 'H',
    };
    for (const key of keys) {
      const definition = TEMPLATES[key];
      for (const channel of definition.channels) {
        expect(() => renderTemplate(definition, channel, values)).not.toThrow();
      }
    }
  });
});
