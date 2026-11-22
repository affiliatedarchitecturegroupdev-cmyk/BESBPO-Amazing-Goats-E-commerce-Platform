import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { RequirePermissions, userFromRequest } from '@ag/nest-auth';
import { AssistantService } from './assistant.service';

/** The question a customer asks, and which conversation it belongs to. */
export interface AskBody {
  question: string;
  conversationId: string;
}

/** A stable id for a conversation, so a follow-up question joins the same log. */
const CONVERSATION_ID = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * The shopping assistant. Signed-in and anonymous shoppers both use it; the
 * route is rate-limited by the gateway's global guard (`ROUTE_RULES`), not by
 * the model provider.
 */
@Controller('gateway/assistant')
export class AssistantController {
  constructor(private readonly service: AssistantService) {}

  @Post()
  @RequirePermissions('catalog:read')
  ask(@Body() body: AskBody, @Req() req: any) {
    const question = typeof body?.question === 'string' ? body.question : '';
    const raw = typeof body?.conversationId === 'string' ? body.conversationId : '';
    // A malformed id is replaced rather than rejected: the customer still gets
    // an answer, and the log still groups the turn.
    const conversationId = CONVERSATION_ID.test(raw) ? raw : `anon-${randomId()}`;
    const userId = userFromRequest(req)?.id;
    return this.service.ask(
      { question, conversationId, ...(userId ? { userId } : {}) },
      authorization(req),
    );
  }

  /**
   * The turns of one conversation, for a reviewer reconstructing a disputed
   * answer. `audit:read` only: the log holds what customers asked.
   */
  @Get('conversations/:conversationId')
  @RequirePermissions('audit:read')
  conversation(@Param('conversationId') conversationId: string) {
    return this.service.conversation(conversationId);
  }
}

function authorization(req: any): string | undefined {
  const v = req?.headers?.authorization;
  return typeof v === 'string' ? v : undefined;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
