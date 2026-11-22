import { describe, it, expect } from 'vitest';
import { confirmPath, subscribePath, unsubscribePath } from './newsletter';

describe('newsletter paths', () => {
  it('points subscribe at the public route', () => {
    expect(subscribePath()).toBe('/notifications/subscribe');
  });

  it('encodes a token, so a token with reserved characters still forms a valid URL', () => {
    expect(confirmPath('a+b/c=')).toBe('/notifications/subscribe/confirm?token=a%2Bb%2Fc%3D');
    expect(unsubscribePath('a+b/c=')).toBe('/notifications/unsubscribe?token=a%2Bb%2Fc%3D');
  });
});
