import { describe, expect, it } from 'vitest';
import { shareTargets, shareUrl } from './share';

const input = { url: 'https://amazinggoats.store/product/lamb-box', title: 'Full lamb box' };

describe('shareTargets', () => {
  it('puts WhatsApp first', () => {
    expect(shareTargets(input)[0].channel).toBe('whatsapp');
  });

  it('builds a wa.me link carrying the title and URL', () => {
    const wa = shareTargets(input).find((t) => t.channel === 'whatsapp');
    expect(wa?.href).toContain('https://wa.me/?text=');
    expect(decodeURIComponent(wa!.href)).toContain('Full lamb box');
    expect(decodeURIComponent(wa!.href)).toContain('https://amazinggoats.store/product/lamb-box');
  });

  it('encodes characters that would otherwise break the URL', () => {
    const t = shareTargets({ url: 'https://x.test/a?b=1&c=2#top', title: 'Chops & ribs 100%' });
    const wa = t.find((x) => x.channel === 'whatsapp')!;
    // A raw `&` or `#` would end the parameter early and truncate the message.
    expect(wa.href).not.toContain('Chops &');
    expect(wa.href).toContain('%26');
    expect(wa.href).toContain('%23');
  });

  it('sends the bare URL to Facebook, which builds its own preview', () => {
    const fb = shareTargets(input).find((t) => t.channel === 'facebook');
    expect(fb?.href).toBe(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(input.url)}`,
    );
    // Facebook ignores a pasted title and would show it twice.
    expect(fb?.href).not.toContain('Full%20lamb%20box');
  });

  it('sends URL and title to X', () => {
    const x = shareTargets(input).find((t) => t.channel === 'x');
    expect(x?.href).toContain(`url=${encodeURIComponent(input.url)}`);
    expect(x?.href).toContain(`text=${encodeURIComponent(input.title)}`);
  });

  it('builds a mailto with subject and body', () => {
    const mail = shareTargets(input).find((t) => t.channel === 'email');
    expect(mail?.href).toContain('mailto:?subject=');
    expect(decodeURIComponent(mail!.href)).toContain('Full lamb box');
  });

  it('gives every target a label and an absolute URL', () => {
    for (const t of shareTargets(input)) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.href).toMatch(/^(https:\/\/|mailto:)/);
    }
  });
});

describe('shareUrl', () => {
  it('joins a path to the base with exactly one slash', () => {
    expect(shareUrl('https://a.test', '/product/x')).toBe('https://a.test/product/x');
    expect(shareUrl('https://a.test/', '/product/x')).toBe('https://a.test/product/x');
    expect(shareUrl('https://a.test', 'product/x')).toBe('https://a.test/product/x');
  });

  it('leaves an absolute URL alone, so the share text has one origin', () => {
    expect(shareUrl('https://a.test', 'https://b.test/x')).toBe('https://b.test/x');
  });
});
