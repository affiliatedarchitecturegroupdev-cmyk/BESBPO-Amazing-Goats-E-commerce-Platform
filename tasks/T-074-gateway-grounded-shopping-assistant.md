---
id: T-074
title: Gateway: grounded shopping assistant with refusal and citations
phase: 6
agent: backend
gate: gate:new-dependency
files: ["services/gateway/src/**", "packages/api-client/**", "db/migrations/**"]
---
## Goal
Customers ask questions the catalogue cannot answer by browsing: "what is in the family
lamb box", "how long does delivery take to Ballito", "what do I do with a whole
shoulder", "can I get it halaal". A context-aware assistant answers them, and it is
also the highest-risk feature in phase 6: a generic LLM bolted to a storefront will
invent prices, promise delivery dates and invent stock.

For a food business that is a compliance problem (R146 of 2010 misleading claims) and a
commercial one (a quoted wrong price). ADR 0013 §4 fixes the rules; this card
implements them.

## Acceptance
- [ ] `services/gateway/src/assistant/` module — no new deployable (ADR 0002)
- [ ] `AnswerModel` interface with one hosted-LLM implementation and one canned test implementation, so the assistant is testable with no network
- [ ] Retrieval over: catalogue rows (name, price, pack, availability), cycle cut-off data, delivery zones, published content (T-071/T-072), and the legal pages
- [ ] **Prices are never model output.** The model returns selected SKUs; code reads the row and formats with `formatZar`. A test asserts a price question returns exactly the catalogue value
- [ ] No retrieved fact → a fixed refusal constant naming a human channel, never improvised text
- [ ] Every answer cites the product or page it drew from, as a link
- [ ] Delivery dates come from the cut-off engine, never from the model
- [ ] `POST /gateway/assistant` accepts a question and a conversation id, returns `{answer, citations[], refused}`
- [ ] Conversation log records the retrieved fact ids so a disputed answer can be reconstructed; readable only with `audit:read`; retention per `docs/02-access-control.md`
- [ ] Rate limited per session, and the rate limit is on the gateway, not the model provider
- [ ] Prompt-injection resistant: a question containing instructions to ignore the rules or reveal the prompt gets the refusal, not compliance
- [ ] Tests added and passing: price equality, refusal on unknown, citation presence, injection attempt, rate limit, log redaction

## Notes
Gate is `gate:new-dependency` — this adds an LLM client and an outbound network call
from the gateway. The provider is behind an interface like the payment providers
(ADR 0007), so it can change without touching retrieval or rules.

No vector database at launch (ADR 0013 §4): the corpus is small and structured, and
inspectable retrieval is worth more than embedding recall. Adding embeddings later is
additive behind the same interface.

This card depends on T-071 and T-072 for content to retrieve. Without them the
assistant will refuse often — which is correct behaviour and a signal to write content,
not to loosen the rules.

The storefront chat widget is a separate, smaller card; this card is the service and
its guardrails.
