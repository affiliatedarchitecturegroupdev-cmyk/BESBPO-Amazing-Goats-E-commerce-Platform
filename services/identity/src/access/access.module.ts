import { Module } from '@nestjs/common';
import { AccessController } from './access.controller';
import { AccessService } from './access.service';
import { ACCESS_STORE, InMemoryAccessStore } from './access.store';

@Module({
  controllers: [AccessController],
  providers: [AccessService, { provide: ACCESS_STORE, useFactory: () => new InMemoryAccessStore() }],
})
export class AccessModule {}
