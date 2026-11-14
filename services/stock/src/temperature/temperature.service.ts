import { Injectable } from '@nestjs/common';

@Injectable()
export class TemperatureService {
  list(): unknown[] { return []; } // TODO(agent): read from the stock schema
}
