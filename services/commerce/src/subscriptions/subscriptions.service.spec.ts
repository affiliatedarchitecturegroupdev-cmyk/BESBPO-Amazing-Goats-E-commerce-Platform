import { describe, it, expect } from 'vitest';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsService', () => {
  it('starts empty', () => { expect(new SubscriptionsService().list()).toEqual([]); });
});
