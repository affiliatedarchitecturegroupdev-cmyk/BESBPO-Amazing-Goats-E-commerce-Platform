import { describe, it, expect } from 'vitest';
import { CampaignsService } from './campaigns.service';

describe('CampaignsService', () => {
  it('starts empty', () => { expect(new CampaignsService().list()).toEqual([]); });
});
