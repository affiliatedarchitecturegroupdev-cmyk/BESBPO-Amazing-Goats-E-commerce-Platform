import { describe, it, expect } from 'vitest';
import { contentListPath, contentPath, publishContentPath } from './content';

describe('content paths', () => {
  it('builds a bare list path', () => {
    expect(contentListPath()).toBe('/commerce/content');
  });

  it('builds a filtered list path', () => {
    expect(contentListPath({ kind: 'recipe', taxonomy: ['lamb', 'winter'], limit: 10 })).toBe(
      '/commerce/content?kind=recipe&taxonomy=lamb%2Cwinter&limit=10',
    );
  });

  it('encodes a slug', () => {
    expect(contentPath('goat curry')).toBe('/commerce/content/goat%20curry');
  });

  it('builds the publish path', () => {
    expect(publishContentPath('c1')).toBe('/commerce/content/c1/publish');
  });
});
