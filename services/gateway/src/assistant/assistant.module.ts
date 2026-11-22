import { Module } from '@nestjs/common';
import { BffModule } from '../bff/bff.module';
import { ANSWER_MODEL, AssistantService, CONVERSATION_STORE, FACT_SOURCE } from './assistant.service';
import { AssistantController } from './assistant.controller';
import { CannedAnswerModel, HostedAnswerModel, RankingAnswerModel, hostedModelFromEnv } from './answer-model';
import type { AnswerModel, ModelFetch } from './answer-model';
import { InMemoryConversationStore } from './conversation.store';
import { UpstreamFactSource } from './upstream-fact-source';

/**
 * The assistant, as a module in the gateway BFF (ADR 0002: no new deployable;
 * ADR 0013 s4).
 *
 * The model is the ranking one unless a hosted model is configured. The
 * selection path is the same either way, so enabling a provider changes recall,
 * not the guarantee that a price comes from a row.
 */
@Module({
  // BffModule exports the upstream config and fetch the fact source reads with,
  // so the assistant shares one configuration rather than a second copy.
  imports: [BffModule],
  controllers: [AssistantController],
  providers: [
    AssistantService,
    { provide: FACT_SOURCE, useClass: UpstreamFactSource },
    { provide: CONVERSATION_STORE, useClass: InMemoryConversationStore },
    {
      provide: ANSWER_MODEL,
      useFactory: (): AnswerModel => {
        const hosted = hostedModelFromEnv(
          process.env,
          ((globalThis as { fetch?: unknown }).fetch as ModelFetch) ?? (async () => {
            throw new Error('no fetch available');
          }),
        );
        return hosted ?? new RankingAnswerModel();
      },
    },
  ],
  // Re-exported so a future consumer (the storefront chat widget's BFF route)
  // reuses the same instance rather than a second fact source.
  exports: [AssistantService],
})
export class AssistantModule {}

export { CannedAnswerModel, HostedAnswerModel, RankingAnswerModel };
