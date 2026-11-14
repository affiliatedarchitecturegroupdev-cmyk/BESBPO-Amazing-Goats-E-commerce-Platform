import { describe, it, expect } from 'vitest';
import { WebhooksService } from './webhooks.service';

describe('WebhooksService', () => {
  it('starts empty', () => { expect(new WebhooksService().list()).toEqual([]); });
});
