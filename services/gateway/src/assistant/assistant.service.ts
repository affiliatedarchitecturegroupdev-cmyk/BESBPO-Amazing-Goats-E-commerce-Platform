import { Inject, Injectable, Optional } from '@nestjs/common';
import { policyBySlug } from '@ag/policy';
import type { PolicyDocument } from '@ag/policy';
import {
  AnswerModel,
  RankingAnswerModel,
} from './answer-model';
import {
  answerQuestion,
  factIds,
  looksLikeInjection,
  rankFacts,
  REFUSAL_ANSWER,
  REFUSAL_CITATION,
  type AssistantAnswer,
  type Fact,
} from './assistant.rules';
import {
  buildFacts,
  type CatalogueRow,
  type ContentRow,
  type CycleRow,
  type FactSources,
  type ZoneRow,
} from './assistant.facts';
import { ConversationStore, buildTurn } from './conversation.store';

export const ANSWER_MODEL = Symbol('ANSWER_MODEL');
export const CONVERSATION_STORE = Symbol('CONVERSATION_STORE');
export const FACT_SOURCE = Symbol('FACT_SOURCE');

/**
 * Where the service reads facts from. The gateway implementation calls the same
 * upstream APIs the BFF proxies, so the assistant has no privileged path to data
 * (ADR 0013 s4). Tests pass a fixed source.
 */
export interface FactSource {
  catalogue(authorization?: string): Promise<CatalogueRow[]>;
  cycle(authorization?: string): Promise<CycleRow | undefined>;
  zones(authorization?: string): Promise<ZoneRow[]>;
  content(authorization?: string): Promise<ContentRow[]>;
}

/** The policy documents retrieval may quote. Read from the shared package. */
export const POLICY_SLUGS = ['terms', 'returns', 'privacy', 'cookies', 'contact', 'about'] as const;

export function policies(): PolicyDocument[] {
  return POLICY_SLUGS.map((slug) => policyBySlug(slug)).filter(
    (doc): doc is PolicyDocument => doc !== undefined,
  );
}

/** How many facts the answer may mention. */
const ANSWER_FACT_LIMIT = 4;

@Injectable()
export class AssistantService {
  constructor(
    @Inject(FACT_SOURCE) private readonly source: FactSource,
    @Inject(CONVERSATION_STORE) private readonly log: ConversationStore,
    @Optional() @Inject(ANSWER_MODEL) private readonly model: AnswerModel = new RankingAnswerModel(),
  ) {}

  /**
   * Answer one question.
   *
   * The order matters: an injection attempt is refused *before* retrieval runs,
   * so a hostile question cannot use the shape of the answer to probe what the
   * catalogue holds.
   */
  async ask(
    input: { question: string; conversationId: string; userId?: string },
    authorization?: string,
  ): Promise<AssistantAnswer> {
    const question = input.question.trim();
    if (question.length === 0) {
      return { answer: REFUSAL_ANSWER, citations: [REFUSAL_CITATION], refused: true };
    }

    const injection = looksLikeInjection(question);
    const facts = injection ? [] : await this.retrieve(authorization);
    const ranked = rankFacts(facts, question);

    // The model only reorders/selects among facts retrieval already found.
    const selected = ranked.length > 0 ? await this.select(question, ranked) : [];
    const used = selected.length > 0 ? selected : ranked.slice(0, ANSWER_FACT_LIMIT);

    const answer = answerQuestion(question, used);

    await this.log.append(
      buildTurn({
        conversationId: input.conversationId,
        question,
        answer: answer.answer,
        refused: answer.refused,
        factIds: factIds(used),
        model: this.model.name,
        ...(input.userId ? { userId: input.userId } : {}),
      }),
    );

    return answer;
  }

  /** The turns of one conversation, for an `audit:read` reviewer. */
  async conversation(conversationId: string) {
    return this.log.list(conversationId);
  }

  /**
   * Ask the model which facts to mention, then map ids back to facts. An id the
   * model invented cannot survive this lookup, because the map is built from the
   * facts retrieval found.
   */
  private async select(question: string, facts: readonly Fact[]): Promise<Fact[]> {
    let ids: string[];
    try {
      ids = await this.model.choose(question, facts);
    } catch {
      return [];
    }
    const byId = new Map(facts.map((f) => [f.id, f]));
    const chosen: Fact[] = [];
    for (const id of ids) {
      const fact = byId.get(id);
      if (fact && !chosen.includes(fact)) chosen.push(fact);
    }
    return chosen.slice(0, ANSWER_FACT_LIMIT);
  }

  /**
   * Retrieve the whole fact set, tolerating a partial outage: a failing upstream
   * yields no facts of that kind rather than failing the question, and the
   * refusal path covers a question those facts would have answered.
   */
  private async retrieve(authorization?: string): Promise<Fact[]> {
    const sources: FactSources = {};
    const [catalogue, cycle, zones, content] = await Promise.all([
      this.source.catalogue(authorization).catch(() => []),
      this.source.cycle(authorization).catch(() => undefined),
      this.source.zones(authorization).catch(() => []),
      this.source.content(authorization).catch(() => []),
    ]);
    sources.catalogue = catalogue;
    sources.cycle = cycle;
    sources.zones = zones;
    sources.content = content;
    sources.policies = policies();
    return buildFacts(sources);
  }
}
