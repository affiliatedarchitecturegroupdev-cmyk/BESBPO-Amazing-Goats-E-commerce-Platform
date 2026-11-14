import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  list(): unknown[] { return []; } // TODO(agent): read from the gateway schema
}
