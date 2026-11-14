import { Injectable } from '@nestjs/common';

@Injectable()
export class CampaignsService {
  list(): unknown[] { return []; } // TODO(agent): read from the ads schema
}
