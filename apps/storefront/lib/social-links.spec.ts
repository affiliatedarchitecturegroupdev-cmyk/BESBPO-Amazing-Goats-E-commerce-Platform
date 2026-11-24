import { describe, expect, it } from 'vitest';
import { SOCIAL_ENV, socialLinks } from './social-links';

describe('socialLinks', () => {
  it('renders nothing when no channel is configured', () => {
    expect(socialLinks({})).toEqual([]);
  });

  it('omits a channel with no handle rather than linking to its front page', () => {
    const links = socialLinks({ [SOCIAL_ENV.facebook]: 'amazinggoats' });
    expect(links.map((l) => l.channel)).toEqual(['facebook']);
    // The point of the card: no link that lands on facebook.com itself.
    for (const l of links) expect(l.href).not.toMatch(/^https:\/\/[^/]+\/?$/);
  });

  it('ignores a blank or whitespace-only handle', () => {
    expect(socialLinks({ [SOCIAL_ENV.instagram]: '   ' })).toEqual([]);
  });

  it('strips a leading @ and a pasted profile URL', () => {
    const fromAt = socialLinks({ [SOCIAL_ENV.x]: '@amazinggoats' });
    const fromUrl = socialLinks({ [SOCIAL_ENV.x]: 'https://x.com/amazinggoats' });
    expect(fromAt[0].href).toBe('https://x.com/amazinggoats');
    expect(fromUrl[0].href).toBe('https://x.com/amazinggoats');
  });

  it('builds a digits-only wa.me link', () => {
    const links = socialLinks({ [SOCIAL_ENV.whatsapp]: '+27 82 555 0100' });
    expect(links[0].href).toBe('https://wa.me/27825550100');
  });

  it('drops a WhatsApp value that is not a number, which would be a dead link', () => {
    expect(socialLinks({ [SOCIAL_ENV.whatsapp]: 'ask us' })).toEqual([]);
  });

  it('keeps a fixed order regardless of the order the variables are set', () => {
    const links = socialLinks({
      [SOCIAL_ENV.youtube]: 'amazinggoats',
      [SOCIAL_ENV.facebook]: 'amazinggoats',
      [SOCIAL_ENV.whatsapp]: '27825550100',
    });
    expect(links.map((l) => l.channel)).toEqual(['whatsapp', 'facebook', 'youtube']);
  });

  it('gives every link a label and an absolute URL', () => {
    const links = socialLinks({
      [SOCIAL_ENV.facebook]: 'a',
      [SOCIAL_ENV.instagram]: 'a',
      [SOCIAL_ENV.x]: 'a',
      [SOCIAL_ENV.youtube]: 'a',
    });
    for (const l of links) {
      expect(l.label.length).toBeGreaterThan(0);
      expect(l.href).toMatch(/^https:\/\//);
    }
  });
});
