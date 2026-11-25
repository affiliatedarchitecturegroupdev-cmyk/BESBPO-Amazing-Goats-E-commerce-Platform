import { describe, it, expect } from 'vitest';
import { bodyToHtml, escapeHtml, renderHtml } from './html';

describe('escapeHtml', () => {
  it('escapes the characters that change markup', () => {
    expect(escapeHtml(`<script>alert("x")</script> & '`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;',
    );
  });

  it('leaves ordinary text untouched', () => {
    expect(escapeHtml('Thabo Mbeki, 2 kg lamb')).toBe('Thabo Mbeki, 2 kg lamb');
  });
});

describe('bodyToHtml', () => {
  it('renders a paragraph per blank-line-separated block', () => {
    const html = bodyToHtml('First para.\n\nSecond para.');
    expect(html).toContain('First para.');
    expect(html).toContain('Second para.');
    expect(html.match(/<p /g)).toHaveLength(2);
  });

  it('keeps single newlines as line breaks inside a block', () => {
    expect(bodyToHtml('line one\nline two')).toContain('line one<br>line two');
  });

  it('escapes customer data rather than rendering it as markup', () => {
    const html = bodyToHtml('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('links a URL without breaking the escaping', () => {
    const html = bodyToHtml('Track it: https://amazinggoats.store/track/42');
    expect(html).toContain('<a href="https://amazinggoats.store/track/42">');
  });

  it('links a URL carrying a query string, escaped once', () => {
    const html = bodyToHtml('See https://example.com/a?b=1&c=2');
    expect(html).toContain('href="https://example.com/a?b=1&amp;c=2"');
    expect(html).not.toContain('&amp;amp;');
  });

  it('returns nothing for an empty body', () => {
    expect(bodyToHtml('')).toBe('');
  });
});

describe('renderHtml', () => {
  it('produces a complete document with the subject as the title', () => {
    const html = renderHtml({ channel: 'email', subject: 'Order 42 confirmed', body: 'Hi Thabo' });
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<title>Order 42 confirmed</title>');
    expect(html).toContain('Hi Thabo');
  });

  it('escapes the subject in the title', () => {
    const html = renderHtml({ channel: 'email', subject: '<b>x</b>', body: 'body' });
    expect(html).toContain('<title>&lt;b&gt;x&lt;/b&gt;</title>');
  });

  it('falls back to the business name when there is no subject', () => {
    expect(renderHtml({ channel: 'email', body: 'body' })).toContain(
      '<title>Amazing Goats</title>',
    );
  });
});
