# Accessibility and performance: what the T-080 audit found

Neither had ever been measured. This note records the audit, what it found, what was
fixed, and what is left. It exists so the next person does not have to rediscover that
the header links were invisible and the product skeleton was the wrong shape.

WCAG 2.2 AA is the standard a South African public-facing service is held to, and the
Consumer Protection Act requires information to be accessible to an ordinary consumer.
Performance is a competitive requirement in a market that shops on a mid-range Android
phone over mobile data, not a desktop on fibre.

## How to re-run it

All three scripts drive real Chromium against a running storefront. They need the
gateway; `scripts/audit-gateway-stub.mjs` serves fixture data so every public route
renders real content without the full back end.

```bash
node scripts/audit-gateway-stub.mjs &          # fixture gateway on :4602
cd apps/storefront && GATEWAY_URL=http://localhost:4602 PORT=4603 pnpm start &

node scripts/a11y-audit.mjs http://localhost:4603    # axe, 27 routes
node scripts/keyboard-walk.mjs http://localhost:4603 # Tab-only purchase path
node scripts/web-vitals.mjs http://localhost:4603    # LCP, CLS, TTFB, bytes
```

`scripts/perf-budget.spec.mjs` runs in CI under `pnpm test`. It cannot measure timing —
that would be flaky in CI — so it guards the structural causes instead: a budget that is
declared and not vacuous, an `<img>` without dimensions, a product route with the wrong
skeleton shape.

## Result

27 public routes, 0 axe violations, 0 violating nodes. Keyboard-only walkthrough of
browse → product → cart → checkout: no traps, no invisible focus stops, a visible ring
on every stop. All 18 controls on checkout and cart have accessible names.

Measured on a 390×844 viewport, 1.6 Mbps down, 150 ms latency, 4× CPU throttle:

| Route | LCP | CLS | TTFB | JS+CSS |
| --- | --- | --- | --- | --- |
| `/` | 484 ms | 0.000 | 217 ms | 115 kB |
| `/shop/lamb` | 388 ms | 0.000 | 22 ms | 116 kB |
| `/product/AG-LM-002` | 1180 ms | 0.015 | 23 ms | 117 kB |

Budget (`scripts/perf-budget.json`): LCP 2500 ms, CLS 0.1, TTFB 800 ms, 250 kB,
6 long tasks. These are the Google "good" boundaries, not our measurements rounded up,
so the budget still means something.

## What was wrong, and the fix

**Header links were unreadable.** `globals.css` had no anchor rule and no header
styling at all, so the category nav fell back to the browser default link blue
`#0000ee` on the forest-green bar `#1F3B2D` — **1.29:1**, against the 4.5:1 that AA
requires. Nine violations on every page. Cream `#F4ECD8` on forest is **10.36:1**, so
the links now take `var(--cream)`, with an underline on hover and focus so the
affordance is not colour alone. No brand token changed; the tokens were already right
and simply were not used.

**No skip link.** Ten header links stood between the top of the page and the content on
every route, so a keyboard user tabbed through the nav ten times per page. A skip link
is now the first stop, visible only when focused, and `<main>` has `id="main"`.

**No focus ring.** There was no `:focus-visible` rule anywhere, so focus relied on the
UA default, which the header's inline colours could override. There is now a 3 px
outline with a 2 px offset, switched to `--ochre` inside the header where `--kalahari`
would not read against the dark green.

**The home page had no `h1`.** The wireframe opens on a cut-off banner and an ad slot
with no visible heading, so the page had no heading to land on and its `h2` sections had
no parent. A visually hidden `h1` adds the outline entry without inventing design.

**The product skeleton was the wrong shape, and that was the CLS.** `app/loading.tsx`
mirrors a six-card grid, which is right for a catalogue route. The product page is one
card. On a throttled phone the skeleton reserved 2135 px, the real page arrived at
489 px, and the footer jumped up 1645 px — **CLS 0.111**, over the 0.1 threshold. The
product route now has its own `loading.tsx` with one card: **CLS 0.015**.

**The ad image had no dimensions.** `<img src={ad.assetUrl}>` in `ServedAdSlot` reserved
no box, so a slow creative shifted the page as it decoded. It now carries `width` and
`height`. The recipe images already had dimensions and were left alone.

## Two false alarms worth recording

Both cost real time and would cost it again.

**Stale `next-server` processes.** `document-title` violations appeared and disappeared
across runs, and `.chips` touch targets measured 19 px. Neither was an app bug. An old
`next-server` was still bound to the port serving a previous build, so pages referenced
a CSS chunk that no longer existed: the stylesheet 400'd, the page rendered unstyled,
and metadata was dropped. `target-size` and most `document-title` findings vanished once
the process was killed and the app restarted. **Always kill the old server before
measuring**; a stale build looks exactly like a regression.

**`next/image` was not the fix here.** The card asks for `next/image`, but recipe and ad
photos are editor-supplied URLs from outside `public/`, and `next/image` needs its hosts
configured at build time. Explicit `width`/`height` gives the CLS benefit without
committing to a host list we do not control. The `RecipeCard` comment already said this;
moving to `next/image` is the right change once images live in our own storage.

## What is not done

**INP needs field data.** It measures the response to real interaction and cannot be
produced in a lab run without inventing a number. The script reports long tasks instead
(1–2 per route) and says so. Set up field measurement before claiming an INP figure.

**The driver PWA was checked by test, not by audit.** Its offline queue is covered by 52
passing unit tests including the IndexedDB queue and proof sync, and its pages are not
in the axe route list. The card asks for the one-handed outdoor path to be re-checked;
that is a real device walkthrough and remains open. Its touch targets and contrast
should be audited with the same scripts before the pilot.

**The portals are unaudited.** Only the storefront was in scope. `apps/admin`,
`apps/trade-portal`, `apps/partner-portal` and `apps/advertiser-portal` share
`globals.css` conventions and almost certainly have the same missing anchor rule. The
fix belongs in `packages/ui-tokens` or a shared stylesheet rather than being copied into
six apps, which is the follow-up this audit recommends.

**No screen-reader session was run.** The accessibility tree was inspected
programmatically and every control has a name, but a VoiceOver or NVDA pass over product
and checkout by a person is the check the card actually wants, and it was not done.
