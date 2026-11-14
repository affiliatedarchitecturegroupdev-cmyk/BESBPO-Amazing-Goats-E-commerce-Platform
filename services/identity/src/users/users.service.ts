import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
  list(): unknown[] { return []; } // TODO(agent): read from the identity schema
}
