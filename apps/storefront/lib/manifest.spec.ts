import { describe, it, expect } from 'vitest';
import { webManifest } from './manifest';

describe('webManifest', () => {
  it('is installable: standalone display, a start URL and a theme colour', () => {
    const m = webManifest('https://shop.example.test');
    expect(m.display).toBe('standalone');
    expect(m.start_url).toBe('/');
    expect(m.theme_color).toBe('#1F3B2D');
    expect(m.background_color).toBe('#F4ECD8');
    expect(m.lang).toBe('en-ZA');
  });

  it('points its icons at the generated icon route, both any and maskable', () => {
    const m = webManifest('https://shop.example.test');
    const icons = m.icons ?? [];
    expect(icons).toHaveLength(2);
    expect(icons.every((i) => i.src === '/icon' && i.type === 'image/png')).toBe(true);
    expect(icons.map((i) => i.purpose).sort()).toEqual(['any', 'maskable']);
  });
});
