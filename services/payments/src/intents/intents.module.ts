import { Module } from '@nestjs/common';
import { IntentsController } from './intents.controller';
import { IntentsService, INTENT_STORE } from './intents.service';
import { InMemoryIntentStore } from './intents.store';
import { ProvidersModule } from '../providers/providers.module';

@Module({
  imports: [ProvidersModule],
  controllers: [IntentsController],
  providers: [
    IntentsService,
    { provide: INTENT_STORE, useFactory: () => new InMemoryIntentStore() },
  ],
  exports: [INTENT_STORE, IntentsService],
})
export class IntentsModule {}
