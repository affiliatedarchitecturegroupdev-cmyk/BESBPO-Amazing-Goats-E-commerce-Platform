import { Injectable } from '@nestjs/common';

@Injectable()
export class ProofOfDeliveryService {
  list(): unknown[] { return []; } // TODO(agent): read from the logistics schema
}
