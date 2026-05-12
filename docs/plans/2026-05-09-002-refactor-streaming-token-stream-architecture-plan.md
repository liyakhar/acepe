---
title: "refactor: Replace client-side reveal projector with canonical token-stream + CSS animation"
type: refactor
status: active
date: 2026-05-09
deepened: 2026-05-09
---

# refactor: Replace client-side reveal projector with canonical token-stream + CSS animation

## Overview

Acepe's streaming text-reveal animation is currently shaped by **three competing state systems** — the canonical session graph (Rust→TS), the desktop hot-state, and a per-row in-memory pacer (`AgentPanelRevealRowMemory`) that lives inside a Svelte derived. The pacer fabricates word timing from RAF clock ticks, the renderer reparses markdown on every delta, a Svelte action walks the parsed DOM and inserts fade spans, and a presentation-graph spread overrides canonical `turnState`. Visual fidelity now diverges between the streaming repro lab (works) and live sessions (often shows no fade), and the architecture is undeterministic by construction.

This plan replaces all of that with **one** authority chain:

```
Rust provider adapter
    └─ AssistantTextDelta { rowId, charOffset, deltaText, producedAtMonotonicMs }
        └─ CanonicalSessionProjection.tokenStream     (TS canonical projection — append-only)
            └─ markdown-it word-wrap core rule        (emits <span class="tok" style="--i:N">)
                └─ CSS custom properties              (--reveal-baseline-ms, --tok-step, --tok-fade-dur)
                    └─ Pure @keyframes animation
```

No client-side pacing. No RAF. No DOM walking. No `{#key}` reparse. No `isLiveTail` heuristic. No `presentationSessionStateGraph` override. Animation timing is pinned to producer-authored monotonic timestamps, so cold-restore renders identically to live-stream and replay-equality holds across clients.

The streaming repro lab — whose animation the user explicitly wants preserved — becomes the default visual behaviour in production, not a special-case demo.

## Problem Frame

Three failure modes the current architecture cannot fix at the projector level:

1. **Live fade missing.** `projectAgentPanelReveal` skips assistant rows that are not `isLiveTail` and have no prior `previousRowMemory`. When canonical envelopes arrive as "tiny Running → big Completed with full text" (or `Completed` before the projector ticks during `Running`), the row is never `isLiveTail` and has no prior memory → projector skips → static markdown branch → zero `.sd-word-fade` spans. The `presentationSessionStateGraph` terminal override (`agent-panel.svelte:466–481`) actively defeats `isLiveTail` by forcing `turnState: "Completed"`.
2. **Non-determinism.** Visible text is `f(envelope_arrival_time, RAF_tick_jitter)` rather than `f(producer_authored_state)`. Two clients restoring the same envelope log produce different DOM. Two windows showing the same session animate at different speeds.
3. **Per-frame DOM cost.** `canonicalStreamingWordFade` walks `node.querySelectorAll("*")` every RAF frame, builds an `AppearanceRecord[]` history, and calls `getComputedStyle` per text node. The `{#key streamingHtml}` block tears down and reparses the markdown subtree on every delta. This is layout-and-style work proportional to message length, on every frame, for every streaming session.

The bar for the replacement is set by GOD architecture and the user's stated criteria: 100% deterministic, byte-tight, production-grade for millions of users, single source of truth, packages/ui purity. The architecture must hold under those criteria simultaneously.

## Requirements Trace

- **R1.** Visual fidelity matches the streaming repro lab today: per-word fade-in, 420 ms duration, cubic-bezier(0.16, 1, 0.3, 1), opacity + 1 px blur + 0.16 em translateY, ~32 ms per-word cadence, respects `prefers-reduced-motion: reduce`, supports an "instant" mode.
- **R2.** Replay determinism: rendering a session is a pure function of the emitted envelope log. Two clients (or a client and its cold-restored self) consuming the same envelope log produce identical `--i` index assignments and identical `animation-delay` values per `.tok` span, so visual appearance and animation timing are indistinguishable. Structural assertion is "same number of `.tok` spans per row, same `--i` value per span, same `--reveal-baseline-ms` per row" — not byte-identical HTML serialization. End-state for fully-elapsed animations is identical opacity/transform/filter.
- **R3.** GOD compliance: `tokenStream` is canonical (lives on `CanonicalSessionProjection`), Rust is the sole writer, no TS fallbacks (`canonical ?? hotState`), no client-side synthesis of canonical state, no provider branching in TS rendering layer.
- **R4.** Wire byte-tightness: each delta is `text + 4 B charOffset + 8 B monotonic ts + identifiers`. No per-frame messages. No client→server traffic for animation.
- **R5.** Per-frame client cost: O(1) per RAF — exactly one CSS custom-property write on the row container. Markdown is parsed once per delta arrival (not per RAF). `opacity` and `transform` properties run on the compositor thread; `filter: blur()` rasterizes on the main thread but only animates on currently-fading words (~1–3 spans at any moment), making main-thread cost bounded and small. If profiling on mid-range GPU targets shows jank, drop `blur` and keep opacity+transform-only fade.
- **R6.** Cold-restore = live-stream: the same code path serves both, with already-elapsed timestamps producing instantly-settled spans via negative `animation-delay`.
- **R7.** Five providers covered (claude, codex, copilot, cursor, opencode): each captures a monotonic timestamp at the `AgentMessageChunk` creation site and synthesizes a stable per-turn message identity when the upstream provider does not emit `message_id`.
- **R8.** Accessibility: AT exposure follows `aria-live="polite"` semantics on the row container; words are always present in the DOM with opacity-only gating. AT receives the full text ahead of the visual reveal, which is the accessible-by-design intent (visual fade is decorative; semantic content arrives complete). The `polite` politeness level is chosen to avoid interrupting on every token while still announcing assistant turns. Owned by Unit 7 (controller binding) and verified there.
- **R9.** No `$effect`. Reactive flow uses `$derived` and store subscriptions; CSS custom-property writes happen in event handlers / snippet attribute bindings.
- **R10.** Hard cutover: prior reveal projector, action, RAF loop, gates, overrides, and `{#key}` reparse are deleted in the same change set that lands the new pipeline. No coexistence flag.

## Scope Boundaries

**In scope**
- Rust `AssistantTextDelta` envelope schema and emission across all five provider adapters.
- TS canonical projection widening (`tokenStream` field, command router, apply handler, store accessor).
- `markdown-it` word-wrap plugin emitting `.tok` spans with stable `--i` indices.
- CSS animation engine (`.tok` class, `@keyframes sd-tok-fade`, custom-property contract).
- Controller binding of `--reveal-baseline-ms` / `--tok-step` / `--tok-fade-dur` and `data-streaming-mode` on the assistant-row container.
- Streaming repro lab refactor to feed the new envelope shape and remain a deterministic harness.
- Deletion of every reader/writer enumerated in Section "Implementation Units" → Unit 9.
- Replay-equality test harness.

**Out of scope**
- Tool-call streaming animation (separate concern, different DOM, different state shape).
- Markdown rendering quality changes (lists, tables, code fences) — the plugin must skip code/HTML tokens but not change them.
- Persistence schema for the durable transcript journal (already covered by `2026-05-05-001-fix-streaming-session-state-incident-plan.md`).
- Mobile/touch-specific animation tuning.
- Per-user customization of `--tok-step` or `--tok-fade-dur` (constants for now; CSS-var future-proof).

## Context & Research

### Relevant Code and Patterns

- **Rust envelope pipeline:**
  - `packages/desktop/src-tauri/src/acp/session_state_engine/envelope.rs` (`SessionStateEnvelope` + `SessionStatePayload` enum — add `AssistantTextDelta` variant)
  - `packages/desktop/src-tauri/src/acp/session_state_engine/protocol.rs` (payload discriminator)
  - `packages/desktop/src-tauri/src/acp/session_state_engine/runtime_registry.rs` (`build_live_session_state_envelope`, line 211; `build_live_session_state_delta_envelope`, line 668; emission sites lines 920/956/1000/1488/1560/1720/1761)
  - `packages/desktop/src-tauri/src/acp/streaming_accumulator.rs` (already uses `Instant::now()` — reference pattern for monotonic capture)
- **Provider parsers** (capture `Instant::now()` at `AgentMessageChunk` creation):
  - `packages/desktop/src-tauri/src/acp/parsers/cc_sdk_bridge.rs` (line 517 `text_delta`, line 523 emits chunk)
  - `packages/desktop/src-tauri/src/acp/parsers/codex_parser.rs` (line 158 text)
  - `packages/desktop/src-tauri/src/acp/parsers/cursor_parser.rs` (line 180 text)
  - `packages/desktop/src-tauri/src/acp/parsers/shared_chat.rs` (line 120 agentMessageChunk — Copilot)
  - `packages/desktop/src-tauri/src/acp/parsers/opencode_parser.rs` (line 105 text)
- **Rust shared chunk type:** `packages/desktop/src-tauri/src/acp/session_update/types/content.rs` (`SessionUpdate::AgentMessageChunk` — add optional `produced_at_monotonic_ms: u64` field)
- **Transcript projection:** `packages/desktop/src-tauri/src/acp/transcript_projection/runtime.rs` (line 161 — extracts text into `TranscriptDeltaOperation::AppendSegment`; mirror for token-stream emission)
- **TS canonical projection:** `packages/desktop/src/lib/acp/store/canonical-session-projection.ts` (extend type)
- **TS envelope router:** `packages/desktop/src/lib/acp/session-state/session-state-command-router.ts` (`routeSessionStateEnvelope`)
- **TS store apply path:** `packages/desktop/src/lib/acp/store/session-store.svelte.ts` (`applySessionStateEnvelope`, line 3059; mirror `applyTranscriptDelta` line 3347 pattern)
- **Markdown renderer:** `packages/ui/src/lib/markdown/create-renderer.ts` (markdown-it + Shiki); plugin registry `packages/ui/src/lib/markdown/plugins/registry.ts`
- **Existing markdown plugins** (pattern reference): `packages/ui/src/lib/markdown/plugins/*.ts` (fence, tableWrapper, checkboxBadge, colorBadge, filePathBadge, githubBadge)
- **Agent panel controller:** `packages/desktop/src/lib/acp/components/agent-panel/components/agent-panel.svelte` (delete reveal RAF lines 200–237, projector derived 863–879, terminal override 466–481)
- **Markdown component (passive renderer):** `packages/desktop/src/lib/acp/components/messages/markdown-text.svelte` (delete `canonicalStreamingWordFade` action + `{#key streamingHtml}` block 740–748)
- **Shared UI gate (delete):** `packages/ui/src/components/agent-panel/agent-assistant-message-visible-groups.ts` (`shouldStreamAssistantTextContent`)
- **Display model (delete `isLiveTail`):** `packages/desktop/src/lib/acp/components/agent-panel/logic/agent-panel-display-model.ts` (lines 34, 156, 177, 195, 249, 305, 325, 512, 522)
- **Graph materializer:** `packages/desktop/src/lib/acp/session-state/agent-panel-graph-materializer.ts` (line 546 `findLiveAssistantEntryId` — delete or replace)
- **Scene viewport:** `packages/desktop/src/lib/acp/components/agent-panel/components/scene-content-viewport.svelte` (`renderAssistantBlock` snippet line 854; native-fallback decision line 465; new CSS-prop binding site)
- **Repro lab files:**
  - `packages/desktop/src/lib/acp/components/debug-panel/streaming-repro-controller.ts`
  - `packages/desktop/src/lib/acp/components/debug-panel/streaming-repro-lab.svelte`
  - `packages/desktop/src/lib/acp/components/debug-panel/streaming-repro-graph-fixtures.ts`
- **CSS file for new animation:** `packages/ui/src/components/markdown/markdown-prose.css` (extend with `.tok` rules; remove `.sd-word-fade`)
- **`AssistantRenderBlockContext`:** `packages/ui/src/components/agent-panel/types.ts` (line 86 — replace `revealRenderState` + `streamingAnimationMode` with `tokenRevealCss`)

### Institutional Learnings

From `docs/solutions/` (full report at `/var/folders/.../learnings-research`):

- **`docs/solutions/architectural/final-god-architecture-2026-04-25.md`** — `AssistantTextDelta` must flow through the canonical `SessionStateEnvelope` pipeline; no parallel lane. The `check-diagnostic-import-boundary.ts` lint must continue to keep diagnostics off product imports.
- **`docs/solutions/architectural/canonical-projection-widening-2026-04-28.md`** — Widening pattern (type → `replaceGraph` → `applyGraphPatches` → parity test for cold-open and live-stream). No `canonical ?? hotState` fallback.
- **`docs/solutions/best-practices/canonical-session-projection-ui-derivation-2026-05-01.md`** — `tokenStream` belongs on canonical, never on `SessionTransientProjection`. One apply path, one store field.
- **`docs/solutions/best-practices/agent-panel-content-viewport-reactivity-renderer-2026-05-01.md`** — Do not broadcast live timers from the virtualized viewport. CSS-only animation directly satisfies this.
- **`docs/solutions/best-practices/svelte5-unconditional-snippet-props-2026-04-12.md`** — Snippet definitions must not be wrapped in `{#if}`; conditional content goes inside the snippet body. Applies to the new token-reveal snippet.
- **`docs/solutions/best-practices/reactive-state-async-callbacks-svelte-2026-04-15.md`** — Capture reactive values before async boundaries; if a session/turn switches, no-op on resolve.
- **`docs/solutions/best-practices/bun-module-mock-cache-leakage-2026-04-25.md`** — Mock at the IPC boundary, not at the store façade. Prefer dependency injection for projection-unit tests.
- **`docs/solutions/integration-issues/copilot-permission-prompts-stream-closed-2026-04-09.md`** — Sparse provider payloads must be normalized at the Rust adapter, not in TS. Add contract tests for sparse Copilot delta shapes.
- **`docs/solutions/integration-issues/2026-04-30-cursor-acp-tool-call-id-normalization-and-enrichment-path.md`** — Idempotent normalization at both live ingress and history restore.
- **`docs/solutions/ui-bugs/assistant-text-reveal-streaming-block.md`** — `isStreaming` is canonical generation state; "is this entry being revealed in this panel" is a separate presentation fact. Cold completed history must render as full text with no fade; live-observed completion fades the trailing words. The new `tokenStream` model encodes both naturally because `producedAtMonotonicMs` for a cold-restore is far in the past, producing negative `animation-delay`.

### External References

- **Cursor reverse-engineering precedent** (`docs/plans/2026-04-15-004-refactor-streaming-word-fade-redesign-plan.md`) — confirms word-level `<span>` wrapping at HTML-string emission with CSS `@keyframes` is the production pattern peers ship.
- **markdown-it core ruler API** — official docs: core rules iterate the post-parse `Token[]` and may insert/transform tokens before render. This is the documented hook for word-wrapping.

### Slack Context

Not gathered. No Slack tools dispatched in this session.

## Key Technical Decisions

- **Wire schema = char offsets, not word indices.** `AssistantTextDelta { sessionId, turnId, rowId, charOffset, deltaText, producedAtMonotonicMs, revision }`. **Rationale:** locale-blind, byte-tight (4 B index), idempotent on replay (later deltas with smaller `charOffset` mean a stale duplicate and can be dropped). Word boundaries are a render-time concern, not a wire concern.
- **Visual unit = whitespace-bounded word.** `<span class="tok" style="--i:N">…</span>` where N is the stable word-index within the row. **Rationale:** matches the streaming repro lab visual the user explicitly wants preserved (R1). Per-word fade is the production-grade aesthetic peers ship.
- **CSS animation contract (the entire engine):**
  ```css
  .tok {
    --tok-step: 32ms;
    --tok-fade-dur: 420ms;
    animation: sd-tok-fade var(--tok-fade-dur)
               cubic-bezier(0.16, 1, 0.3, 1) backwards;
    animation-delay: calc(
      var(--reveal-baseline-ms) + var(--i) * var(--tok-step)
    );
  }
  @keyframes sd-tok-fade {
    from { opacity: 0; filter: blur(1px); transform: translateY(0.16em); }
    to   { opacity: 1; filter: blur(0);   transform: none; }
  }
  @media (prefers-reduced-motion: reduce) { .tok { animation: none; } }
  [data-streaming-mode="instant"] .tok { animation: none; }
  ```
  **Rationale:** Animation is a pure function of two custom properties. Negative `animation-delay` (cold-restore case) auto-settles. Reduced-motion and instant-mode collapse to CSS — no JS branching.
- **`tokenStream` lives on `CanonicalSessionProjection`** keyed by **composite `(turnId, rowId)`**. **Rationale:** GOD chain compliance + cross-turn-contamination protection (lesson from `2026-04-18-001`). `rowId` is the per-assistant-message identifier emitted by Rust (synthesized when the provider omits one — see next bullet). The composite turn-prefix means even if `rowId` collides across turns (e.g., reused synthetic counter), entries do not contaminate each other.
- **Synthesize a stable per-turn `rowId` at the Rust adapter edge** for providers that emit no `message_id` (codex `Ra` lesson). The TS map key always exists; sparse-provider quirks never surface in TS. `rowId` corresponds 1:1 with the existing `messageId` concept used in transcript projection — they are the same identifier; the plan uses `rowId` consistently to avoid confusion with provider-supplied `message_id` fields.
- **Markdown re-render strategy:** parse the **fully-accumulated text** to HTML once per delta arrival (not per RAF, not on every char). The word-wrap plugin assigns stable `--i` indices based on token-walk order (atomic for inline-formatting groups; per-word for plain text — see Unit 5). Svelte renders the result via `{@html}` without `{#key}`. `{@html}` replaces innerHTML on every delta — all `.tok` spans are destroyed and recreated. Visual continuity is preserved because `--reveal-baseline-ms` is recomputed at every render: recreated spans whose `--i * --tok-step + --reveal-baseline-ms` is already past `0` snap immediately to settled state via `animation-fill-mode: backwards` + negative `animation-delay`. The mechanism is *node recreation with delay-driven settlement*, not DOM preservation.
- **`renderAssistantBlock` snippet is the CSS-prop binding site.** The desktop controller computes `--reveal-baseline-ms`, `--tok-step`, `--tok-fade-dur` from `tokenStream` + the per-session clock anchors and writes them via `style="..."` on the row container, alongside `data-streaming-mode={mode}` and `aria-live="polite"`. `packages/ui` stays presentational — the `<span class="tok">` markup is in the UI package, the values driving the animation come from the controller.
- **`isStreamingRow` replaces `requiresStableTailMount`/`isLiveTail`** as a row-specific boolean derived from canonical: `canonical.turnState === "Running" && rowId === canonical.lastAgentRowId`. Row-specific predicate ensures only the actively-streaming tail row is treated as live — historical rows in the same running turn are not. `lastAgentRowId` is the canonical projection field already tracking the last emitted assistant-message identifier (verify exact field name when implementing Unit 4; align KTD and Unit 9 if it differs).
- **Visible-group slicing remains.** `agent-assistant-message-visible-groups.ts` keeps its group-boundary logic, but the `shouldStreamAssistantTextContent` heuristic is replaced with a deterministic `currentStreamingGroupIndex` derived from `tokenStream.accumulatedText.length` (char count) against per-group character spans. Owned by Unit 9 (computation + replacement); the `RowTokenStream` type carries `accumulatedText` directly so no new field is needed.
- **Hard cutover, no flag.** Per CLAUDE.md "speed-of-light execution", the new pipeline lands and the old paths are deleted in the same change set.
- **Repro lab refactored, not deleted.** It becomes the deterministic harness for the new envelope shape — its visual is now production behaviour, but it remains the QA contract for the 9 phases.

## Open Questions

### Resolved During Planning

- *Token unit on the wire — char vs word vs grapheme?* → Char offset. Locale-blind, byte-tight, idempotent. Word grouping is a render concern.
- *CSS index unit — char, word, or chunk?* → Word (atomic for inline-formatting groups). Matches repro lab visual; minimizes span count.
- *Hard cutover or feature-flagged migration?* → Hard cutover. Per CLAUDE.md speed-of-light rule. Rollback protocol: full-PR revert. The CSS fallback (no CSS props ⇒ animation off, full text visible) protects the missing-prop failure class but not logic regressions; rollback is the documented contingency.
- *Do we keep the streaming repro lab?* → Yes, refactored to feed the new envelope shape. It is the deterministic QA harness.
- *Do we keep `streamingAnimationMode === "instant"` as a user preference?* → Yes, but as a CSS toggle (`data-streaming-mode="instant"`), not a JS branch.
- *Does the markdown renderer wrap words in code fences too?* → No. The plugin skips `fence`, `code_block`, `html_block`, `html_inline`, `code_inline` tokens.
- *How is cold-restore distinguished from live-stream?* → It isn't, by design. Cold-restored deltas have `rustElapsedMs ≪ browserElapsedMs`, producing strongly negative `revealBaselineMs`, which CSS treats as already-settled. **Design intent:** cold-restored sessions intentionally show fully-settled text. The negative-delay mechanism is the designed behavior, not a workaround. If mid-stream resume becomes a feature in the future, this assumption must be revisited.
- *Where do the CSS custom properties live?* → Set by the desktop controller on the row container element via `style="..."`. `packages/ui` stays pure. `--reveal-count` is *not* emitted on the container (no CSS rule consumes it); it lives on the `tokenRevealCss` snippet context for any future container-style-query use.
- *`tokenRevealCss` field name and shape?* → Resolved: `{ revealCount: number; baselineMs: number; tokStepMs: number; tokFadeDurMs: number; mode: "smooth" | "instant" }` on `AssistantRenderBlockContext` (Unit 7).
- *Clock alignment between Rust `Instant` and browser `performance.now()`?* → Resolved: TS captures `(rustAnchorMs, browserAnchorMs)` on the first delta arrival per session, stored on `CanonicalSessionProjection.clockAnchor`. All baselines computed as `(rustElapsed - browserElapsed)`. See HLD diagram.
- *`messageId` vs `rowId`?* → Resolved: same identifier; plan uses `rowId` consistently. Provider-supplied `message_id` (when present) becomes `rowId`; absent ⇒ Rust synthesizes a stable `rowId`.
- *R8 accessibility approach?* → Resolved: `aria-live="polite"` on row container; words always in DOM; opacity-only gating. No per-word `aria-hidden`. Owned by Unit 7.

### Deferred to Implementation

- Whether the markdown-it word-wrap plugin runs as a core rule or a renderer-rule override. Settle when reading the markdown-it plugin code; either works architecturally.
- Whether the `tokenStream` map uses `Map` or a typed object literal. Settle by mirroring the `transcriptSnapshot` storage shape in the canonical projection.
- Exact `aria-live` politeness level if the existing assistant-message wrapper already specifies one different from `polite`. Verify and align during Unit 7.
- Whether `filter: blur(1px)` is dropped from the keyframe based on profiling. If GPU profiling on representative mid-range hardware shows main-thread paint jank during long messages, drop blur and keep opacity+transform-only fade. Decision at end of Unit 6 / start of Unit 8.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

### Authority chain

```
Rust provider parser
   │
   ▼  capture Instant at AgentMessageChunk creation
SessionUpdate::AgentMessageChunk { produced_at_monotonic_ms, ... }
   │
   ▼
runtime_registry::build_live_session_state_envelope
   │
   ├── existing: build_live_session_state_delta_envelope  (transcript spine, unchanged)
   └── NEW:      build_assistant_text_delta_envelope
                 emits SessionStatePayload::AssistantTextDelta {
                     sessionId, turnId, rowId,
                     charOffset, deltaText,
                     producedAtMonotonicMs, revision
                 }
   │
   ▼  Tauri event: live-session-state-envelope
TS session-state-command-router::routeSessionStateEnvelope
   │
   ▼  new command: applyAssistantTextDelta
TS session-store::applyAssistantTextDelta
   │
   ▼  appends to canonicalProjection.tokenStream[(turnId,rowId)]
CanonicalSessionProjection.tokenStream
   │
   ▼  $derived
SessionStore.getRowTokenStream(sessionId, rowId)
   │
   ▼  consumed by agent-panel.svelte renderAssistantBlock snippet
{@html renderMarkdown(accumulatedText)}   (markdown-it word-wrap core rule emits <span class="tok" style="--i:N">)
   │
   ▼  controller writes CSS custom props on row container
<div class="tok-row"
     style="--reveal-baseline-ms: -1240ms;
            --tok-step: 32ms;
            --tok-fade-dur: 420ms;"
     data-streaming-mode="smooth">
   │
   ▼  pure CSS
.tok { animation-delay: calc(var(--reveal-baseline-ms) + var(--i) * var(--tok-step)); }
```

### Token-stream replay equality (R2 contract)

```
For a given envelope log E, two clients C1 and C2 consuming E with their own
session anchors (rust1, browser1) and (rust2, browser2) produce:
    span_count(C1, E)   = span_count(C2, E)             ; structurally identical
    --i values per span = same in both                  ; identical index assignments
    --reveal-baseline-ms per row = same in both         ; identical because both clients compute
                                                          (rustElapsed_i - browserElapsed_i),
                                                          and within each client both terms
                                                          are anchored to the same first-delta arrival
And once animations elapse:
    final opacity / transform / filter = identical end state
```

Visual appearance and animation timing are indistinguishable across clients. R2 is asserted as structural-span equivalence (same count, same `--i` per span) and equal `--reveal-baseline-ms` per row — not byte-identical HTML serialization.

### Per-row CSS-prop derivation (controller side)

Clock alignment: Rust `Instant`-derived timestamps and browser `performance.now()` share no epoch. The TS layer captures **two browser anchors at first-delta-arrival per session**: `browserAnchorMs = performance.now()` and `rustAnchorMs = firstDelta.producedAtMonotonicMs`. Subsequent deltas align via:

```
For an assistant row R with tokenStream S in session having anchors (rustAnchor, browserAnchor):
    revealCount       = wordCountOf(S.accumulatedText)        // emitted by markdown plugin, see Unit 5
    rustElapsedMs     = S.firstDeltaProducedAtMs - rustAnchor // ms since session-start in Rust frame
    browserNowMs      = performance.now()
    browserElapsedMs  = browserNowMs - browserAnchor          // ms since session-start in browser frame
    revealBaselineMs  = rustElapsedMs - browserElapsedMs
                          // ≈ 0 for live; large negative for cold-restored deltas (rust ts long-ago,
                          // browser anchor recent ⇒ rustElapsedMs ≪ browserElapsedMs)
    tokStepMs         = 32
    tokFadeDurMs      = 420
    mode              = chatPreferencesStore.streamingAnimationMode
```

The session anchors live on `CanonicalSessionProjection` (set once on first `AssistantTextDelta` for that session, never overwritten). Cold-restore loads many already-elapsed deltas before the browser anchor is set; the first cold-load delta sets the browser anchor to `performance.now()` while its Rust timestamp is far in the past, producing strongly negative `revealBaselineMs` for all cold-loaded rows — they snap to settled, which is the design intent.

The desktop controller computes these as a `$derived` from `getRowTokenStream(sessionId, rowId)` and binds them via `style="..."` on the row container. No RAF, no `$effect`.

## Implementation Units

- [ ] **Unit 1: Rust envelope schema — `AssistantTextDelta` payload variant**

  **Goal:** Add the new payload type to the canonical envelope without touching emission yet.

  **Requirements:** R3, R4, R7

  **Dependencies:** None

  **Files:**
  - Modify: `packages/desktop/src-tauri/src/acp/session_state_engine/protocol.rs`
  - Modify: `packages/desktop/src-tauri/src/acp/session_state_engine/envelope.rs`
  - Test: `packages/desktop/src-tauri/src/acp/session_state_engine/__tests__/assistant_text_delta_payload.rs`

  **Approach:**
  - Add `AssistantTextDelta { session_id: String, turn_id: String, row_id: String, char_offset: u32, delta_text: String, produced_at_monotonic_ms: u64, revision: i64 }` to `SessionStatePayload` enum
  - Add Serde discriminator `kind: "assistantTextDelta"` matching existing patterns
  - Pure data type — no behaviour yet

  **Execution note:** Test-first. Write the round-trip JSON test before adding the variant.

  **Patterns to follow:** Existing `Snapshot` / `Delta` / `Lifecycle` variants in the same file.

  **Test scenarios:**
  - Happy path: round-trip serialize/deserialize an `AssistantTextDelta` payload preserves all fields.
  - Edge case: empty `delta_text` is permitted (some providers send empty appends as keepalives).
  - Edge case: `char_offset = 0` is the first delta of a row.
  - Error path: malformed JSON missing `produced_at_monotonic_ms` fails deserialization with a clear error.

  **Verification:** Cargo test passes; envelope JSON snapshot includes the new variant.

- [ ] **Unit 2: Rust monotonic-timestamp capture in `AgentMessageChunk`**

  **Goal:** Add `produced_at_monotonic_ms: Option<u64>` to `SessionUpdate::AgentMessageChunk` and capture `Instant::now()` at every parser entry point.

  **Requirements:** R2, R7

  **Dependencies:** None

  **Files:**
  - Modify: `packages/desktop/src-tauri/src/acp/session_update/types/content.rs`
  - Modify: `packages/desktop/src-tauri/src/acp/parsers/cc_sdk_bridge.rs`
  - Modify: `packages/desktop/src-tauri/src/acp/parsers/codex_parser.rs`
  - Modify: `packages/desktop/src-tauri/src/acp/parsers/cursor_parser.rs`
  - Modify: `packages/desktop/src-tauri/src/acp/parsers/shared_chat.rs`
  - Modify: `packages/desktop/src-tauri/src/acp/parsers/opencode_parser.rs`
  - Test: `packages/desktop/src-tauri/src/acp/parsers/__tests__/agent_message_chunk_timestamp.rs`

  **Approach:**
  - Establish a session-start anchor `Instant` stored on the session graph runtime; emit deltas relative to it as `u64 ms` (avoids wall-clock skew, fits 64 bits for 5+ million years).
  - Each parser captures `Instant::now()` at the line where `AgentMessageChunk` is constructed and computes `(now - sessionAnchor).as_millis() as u64`.
  - On `u64` overflow risk (≈ 5.8 million years): emit a logged error and saturate at `u64::MAX` rather than wrap. (Practically unreachable; defensive only.)
  - Synthesize a stable per-turn `rowId` at the parser edge when the upstream provider emits no `message_id` (use `format!("synth-{turn_id}-{counter}")` with an atomic counter on the session graph runtime). Sanitize: the synthesized id is alphanumeric+`-`+`_` only, by construction. For provider-supplied ids, strip any character outside `[A-Za-z0-9_-]` (replace with `-`) idempotently. This is the same regression class as Cursor tool-call newline normalization (`2026-04-30`).

  **Execution note:** Test-first per parser. Use sparse-provider fixtures (no `message_id`) per the Copilot `permission-prompts-stream-closed-2026-04-09` lesson.

  **Patterns to follow:** `streaming_accumulator.rs` already uses `Instant`. Mirror that capture pattern.

  **Test scenarios:**
  - Happy path: each parser produces an `AgentMessageChunk` with non-None `produced_at_monotonic_ms` and monotonically non-decreasing values across deltas.
  - Edge case: provider with no `message_id` (codex sparse fixture) gets a synthesized stable id repeated across deltas in the same turn.
  - Edge case: provider sends two chunks within 1 ms; timestamps must still be non-decreasing (not strictly increasing — equal is allowed).
  - Integration: a fixture that simulates 100 deltas across all 5 providers shows each parser produces well-formed timestamps.
  - Cross-turn: a new turn produces a different synthesized message_id even when the provider reuses one.

  **Verification:** Cargo test passes for each parser; cross-parser fixture passes.

- [ ] **Unit 3: Rust envelope emission for `AssistantTextDelta`**

  **Goal:** Wire `AgentMessageChunk` into the new envelope payload via `runtime_registry`.

  **Requirements:** R2, R4, R7

  **Dependencies:** Unit 1, Unit 2

  **Files:**
  - Modify: `packages/desktop/src-tauri/src/acp/session_state_engine/runtime_registry.rs`
  - Modify: `packages/desktop/src-tauri/src/acp/transcript_projection/runtime.rs` (track per-row char offset alongside transcript segment append)
  - Test: `packages/desktop/src-tauri/src/acp/session_state_engine/__tests__/assistant_text_delta_emission.rs`

  **Approach:**
  - Add `build_assistant_text_delta_envelope(session_id, turn_id, row_id, char_offset, delta_text, produced_at, revision)` helper alongside `build_live_session_state_delta_envelope` (line 668). Sanitize `row_id` idempotently before constructing the payload: any character outside `[A-Za-z0-9_-]` is replaced with `-` (mirrors the Cursor tool-call-id newline lesson; idempotent so a second pass is a no-op).
  - In `build_live_session_state_envelope` line 352 (transcript-bearing arm), when the underlying update is `AgentMessageChunk`, **also** emit an `AssistantTextDelta` envelope (in addition to, not in place of, the existing transcript delta — the transcript spine is unchanged, the token stream is a new parallel projection). This dual-emit roughly doubles per-chunk IPC text-streaming volume (the chunk text is carried in both envelopes); accepted because per-frame messages remain zero and the absolute volume is small relative to existing tool-call traffic. R4 (byte-tightness) refers to per-frame and per-envelope cost — total per-chunk volume is acknowledged here as a deliberate tradeoff.
  - Track per-row `char_offset` in the transcript projection runtime (stateful counter keyed by `(turn_id, row_id)`), with overflow protection: if accumulated `char_offset` would reach `u32::MAX`, log an error and stop further emission for that row (the transcript still records the text via the unchanged transcript delta path).

  **Execution note:** Test-first. Use a fixture sequence of three text deltas and assert the envelope log emits three `AssistantTextDelta` payloads with `char_offset` 0, 5, 12.

  **Patterns to follow:** `build_live_session_state_delta_envelope` line 668.

  **Test scenarios:**
  - Happy path: three sequential `AgentMessageChunk` updates produce three `AssistantTextDelta` envelopes with monotonically increasing `char_offset`.
  - Edge case: a chunk with empty `delta_text` still produces an envelope (so client can update `producedAtMs` baseline).
  - Edge case: cross-turn — a new turn for the same session resets per-`(turn_id, row_id)` `char_offset` to 0.
  - Integration: a fixture that simulates a full streaming turn (50 chunks, then turn-complete) emits exactly 50 `AssistantTextDelta` envelopes plus the existing `Delta` envelopes for transcript.
  - Replay: same input fixture across two runs produces structurally identical envelope sequences with identical timestamps (R2 baseline).

  **Verification:** Cargo test passes; existing transcript-delta emission tests still green; replay-equality assertion holds.

- [ ] **Unit 4: TS canonical projection widening — `tokenStream` field**

  **Goal:** Extend `CanonicalSessionProjection` with the new field and the apply handler.

  **Requirements:** R3, R5, R6, R10

  **Dependencies:** Unit 3 (defines the wire schema)

  **Files:**
  - Modify: `packages/desktop/src/lib/acp/store/canonical-session-projection.ts`
  - Modify: `packages/desktop/src/lib/acp/session-state/session-state-command-router.ts`
  - Modify: `packages/desktop/src/lib/acp/store/session-store.svelte.ts`
  - Test: `packages/desktop/src/lib/acp/store/__tests__/canonical-session-projection-token-stream.vitest.ts`

  **Approach:**
  - Extend type:
    ```ts
    type RowTokenStream = {
      readonly turnId: string;
      readonly rowId: string;
      readonly accumulatedText: string;
      readonly wordCount: number;            // emitted by markdown plugin (Unit 5) and stored here for parity
      readonly firstDeltaProducedAtMs: number;
      readonly lastDeltaProducedAtMs: number;
      readonly revision: number;
    };
    type SessionClockAnchor = {
      readonly rustAnchorMs: number;     // first delta's producedAtMonotonicMs
      readonly browserAnchorMs: number;  // performance.now() at first-delta arrival
    };
    type CanonicalSessionProjection = {
      /* existing */
      tokenStream: ReadonlyMap<string, RowTokenStream>;
      clockAnchor: SessionClockAnchor | null;  // set once per session; never overwritten
    };
    ```
    Map key = `${turnId}:${rowId}` (composite, prevents cross-turn-contamination).
  - Router: add `applyAssistantTextDelta` command on the `assistantTextDelta` envelope kind.
  - Store handler: revision-guarded append; idempotent on duplicate `charOffset` (same `revision`); rejects `charOffset > accumulatedText.length` and rejects `charOffset < accumulatedText.length` on a non-replay revision (provider regression — log anomaly, preserve state). Rejects malformed envelopes via `Result.err`.
  - On the first `AssistantTextDelta` for a session where `clockAnchor === null`, set both anchors: `rustAnchorMs = delta.producedAtMonotonicMs`, `browserAnchorMs = performance.now()`. Subsequent deltas read but never modify the anchor.
  - Word count: the apply handler computes `wordCount` by calling the same `countWordsInMarkdown(text)` helper that the markdown plugin uses internally (exported from `@acepe/ui`). The helper walks the markdown token tree and applies the inline-formatting grouping rule so controller and plugin agree by construction. Stored on `RowTokenStream` so the controller never needs to re-walk.
  - Add accessor `SessionStore.getRowTokenStream(sessionId, rowId): RowTokenStream | null` and `SessionStore.getClockAnchor(sessionId): SessionClockAnchor | null` reading canonical only (no `?? hotState`).

  **Execution note:** Test-first. Mock at the IPC boundary (`TAURI_COMMAND_CLIENT`), not at the store façade — per `bun-module-mock-cache-leakage-2026-04-25.md`.

  **Patterns to follow:** `applyTranscriptDelta` at session-store.svelte.ts:3347. `applyCapabilities` for the canonical-only accessor pattern.

  **Test scenarios:**
  - Happy path: three sequential deltas produce one `RowTokenStream` with concatenated text and three monotonic `producedAt` values.
  - Edge case: duplicate `charOffset` (same delta replayed on reconnect) is idempotent — text doesn't double.
  - Edge case: `charOffset = 0` overwrites empty initial state cleanly.
  - Edge case: `charOffset > current accumulatedText.length` is rejected with a logged anomaly; existing state preserved.
  - Edge case: deltas for two different `(turnId, rowId)` pairs maintain separate streams.
  - Edge case: revision guard — applying revision N+1 succeeds; revision N (replay) is a no-op.
  - Cross-turn: same `rowId` with different `turnId` produces two separate streams (no contamination).
  - Error path: envelope with malformed payload is dropped; `applySessionStateEnvelope` returns `Result.err` per neverthrow contract.
  - Integration: cold-restore — applying a 50-delta envelope log produces the same final `RowTokenStream` regardless of arrival order grouping.

  **Verification:** vitest passes; `bun run check` and `bun run check:svelte` pass; the existing `session-store-projection-state` parity test extended to cover `tokenStream`.

- [ ] **Unit 5: markdown-it word-wrap plugin emitting `.tok` spans**

  **Goal:** Plugin that wraps each whitespace-bounded word in non-code text with `<span class="tok" style="--i:N">…</span>` where N is the row-stable word index.

  **Requirements:** R1, R2, R5

  **Dependencies:** None (pure renderer change)

  **Files:**
  - Create: `packages/ui/src/lib/markdown/plugins/token-word-wrap.ts`
  - Modify: `packages/ui/src/lib/markdown/plugins/registry.ts`
  - Test: `packages/ui/src/lib/markdown/plugins/__tests__/token-word-wrap.test.ts`

  **Approach:**
  - Register as a POST_SHIKI_PLUGIN core rule. Before adding `ruler.insertAfter("shiki", ...)`, log `md.core.ruler.__rules__` after Shiki registration to confirm the exact rule name (Shiki may register under a different label across versions).
  - Walk the post-parse `Token[]`. Maintain a `wordIndex` counter that persists across blocks of one rendered HTML output (so spans get monotonically increasing `--i` per rendered string).
  - **Grouping-first algorithm** for inline tokens:
    - For tokens of type `inline`, walk `children` left-to-right with a small state machine:
      - On encountering an opening formatting token (`strong_open`, `em_open`, `link_open`, `s_open`), enter "atomic-group" mode: collect children until the matching close token, then emit the entire group (open tag + escaped content + close tag) as **one** atomic span with `class="tok"` and `style="--i:N"` where N is the next `wordIndex`. Increment `wordIndex` once.
      - In top-level (non-grouped) text children, split content on `\s+`. For each non-empty word, emit a span with the next `wordIndex`. Whitespace between words is emitted as plain text (not wrapped).
      - Nested formatting (e.g., `**[link](url)**`): the outermost group wins; nested content is part of the same atomic slot.
  - **HTML escaping:** all word content (top-level and inside formatting groups) must pass through `md.utils.escapeHtml()` before being interpolated into the span. Untrusted provider text is the source.
  - Skip `fence`, `code_block`, `html_block`, `html_inline`, `code_inline` entirely (no word-wrap inside code).
  - Plugin returns the rendered HTML and exposes a `countWordsInMarkdown(text: string): number` helper (re-runs the same walk against a parsed Token tree from the same markdown-it instance, returning the final `wordIndex`). The helper is exported from `@acepe/ui` so Unit 4's apply handler can store `wordCount` on `RowTokenStream` by construction.

  **Patterns to follow:** Existing plugins in `packages/ui/src/lib/markdown/plugins/*.ts` — same `(md: MarkdownIt) => void` signature, registered via `applyPlugins()`.

  **Test scenarios:**
  - Happy path: `"Hello world"` produces two `<span class="tok">` spans with `--i:0` and `--i:1`.
  - Happy path: multiline paragraph: word indices continue across newlines within a paragraph.
  - Edge case: leading/trailing whitespace doesn't produce empty `<span class="tok">`.
  - Edge case: punctuation glued to a word (`"Hello,"`) is one `tok`.
  - Edge case: emoji and combining marks treated as part of the surrounding word (no break inside grapheme).
  - Edge case: code fence content not wrapped — output preserves Shiki HTML untouched.
  - Edge case: inline code (`` `foo` ``) wrapped as one atomic `tok` slot when standalone-word.
  - Edge case: bold (`**foo bar**`) — entire bold span wraps as a single atomic `tok` slot, `--i` advances by 1.
  - Edge case: link `[text with spaces](url)` — entire link wraps as a single atomic `tok` slot.
  - Edge case: nested `**[text](url)**` — outermost group wins, entire structure is one slot.
  - Edge case: list item `- one two` produces `<li>` containing two `tok` spans with continuing `--i`.
  - Edge case: blockquote `> one two` produces `<blockquote>` containing two `tok` spans.
  - Security: word containing `<script>` or `</span>` is HTML-escaped to `&lt;...&gt;` and `&lt;/span&gt;` before wrapping.
  - Parity: `countWordsInMarkdown(text)` returns the exact span count produced by `md.render(text)` — asserted on a fixture corpus of 20 representative messages.
  - Determinism: rendering the same text twice produces identical span structure (same `--i` values, same atomic boundaries).

  **Verification:** vitest passes; existing markdown plugin test suite still green; visual snapshot of a representative paragraph reviewed manually.

- [ ] **Unit 6: CSS animation engine — `.tok` rules and custom-property contract**

  **Goal:** Pure-CSS fade animation, replacing `.sd-word-fade` and removing the JS action.

  **Requirements:** R1, R5, R9

  **Dependencies:** None

  **Files:**
  - Modify: `packages/ui/src/components/markdown/markdown-prose.css`
  - Test: `packages/ui/src/components/markdown/__tests__/markdown-prose-tok-structure.test.ts` (structural HTML assertions only — span count, class names, style-attribute strings; JSDOM cannot resolve CSS custom-property `calc()` so animation timing verification lives in the streaming repro lab visual harness in Unit 8, not here)

  **Approach:**
  - Add `.tok` rule set per the design above.
  - Define `--reveal-baseline-ms`, `--tok-step`, `--tok-fade-dur` defaults at the row level.
  - Add `@media (prefers-reduced-motion: reduce) { .tok { animation: none; } }`.
  - Add `[data-streaming-mode="instant"] .tok { animation: none; }`.
  - Delete `.sd-word-fade` class and `@keyframes sd-fadeIn` (Unit 9 finalizes the deletion).

  **Execution note:** Test-first. Structural HTML / stylesheet-text assertions for the rule shape.

  **Patterns to follow:** Existing `.sd-word-fade` rule in the same file (replaced).

  **Test scenarios:**
  - Structural: a fixture row with `<span class="tok" style="--i:0">` rendered into a JSDOM container with `--reveal-baseline-ms: 0ms` set on the parent — assert the inline `style` string is preserved verbatim.
  - Structural: reduced-motion media query is present in the stylesheet text (parsed via CSS-in-text inspection).
  - Structural: `[data-streaming-mode="instant"]` selector is present in the stylesheet text.
  - Structural: `.tok` rule contains `animation-fill-mode: backwards` (or shorthand equivalent).
  - Structural: `.sd-word-fade` and `@keyframes sd-fadeIn` are absent from the stylesheet.
  - Visual timing verification deferred to Unit 8 (streaming repro lab) — JSDOM cannot evaluate `calc(var(--reveal-baseline-ms) + var(--i) * var(--tok-step))`.

  **Verification:** vitest passes; the streaming repro lab (Unit 8) shows the live-stream and cold-restore phases at the expected visual cadence.

- [ ] **Unit 7: Controller binding — `renderAssistantBlock` snippet sets CSS custom properties**

  **Goal:** The desktop `agent-panel.svelte` controller derives `revealCount`, `revealBaselineMs`, mode from `tokenStream` and writes them via `style="..."` on the assistant-row container.

  **Requirements:** R1, R3, R5, R6, R8, R9

  **Dependencies:** Unit 4, Unit 5, Unit 6

  **Files:**
  - Modify: `packages/desktop/src/lib/acp/components/agent-panel/components/agent-panel.svelte`
  - Modify: `packages/desktop/src/lib/acp/components/agent-panel/components/scene-content-viewport.svelte`
  - Modify: `packages/ui/src/components/agent-panel/types.ts` (replace `revealRenderState` + `streamingAnimationMode` on `AssistantRenderBlockContext` with `tokenRevealCss: { revealCount: number; baselineMs: number; tokStepMs: number; tokFadeDurMs: number; mode: "smooth" | "instant" }`)
  - Modify: `packages/ui/src/components/agent-panel/agent-assistant-message.svelte`
  - Modify: `packages/desktop/src/lib/acp/components/messages/markdown-text.svelte`
  - Test: `packages/desktop/src/lib/acp/components/agent-panel/components/__tests__/agent-panel-token-reveal-binding.svelte.vitest.ts`

  **Approach:**
  - Source `now`: read `performance.now()` directly (no `Date.now()` fallback — environments without `performance` skip CSS-prop binding entirely and render the row with no animation, full text visible). For test environments, inject a clock dependency.
  - For each assistant row, derive:
    - `revealCount` = `tokenStream.wordCount` (precomputed in Unit 4 using the same walker as the markdown plugin — guaranteed parity by construction, no separate `countWords` call).
    - `clockAnchor` = `SessionStore.getClockAnchor(sessionId)` (set on first delta, see Unit 4).
    - `rustElapsedMs` = `tokenStream.firstDeltaProducedAtMs - clockAnchor.rustAnchorMs`.
    - `browserElapsedMs` = `performance.now() - clockAnchor.browserAnchorMs`.
    - `baselineMs` = `rustElapsedMs - browserElapsedMs` (≈ 0 for live; large negative for cold-restore).
    - `tokStepMs` / `tokFadeDurMs` = constants 32 / 420.
    - `mode` = `chatPreferencesStore.streamingAnimationMode`.
  - Bind via `style="--reveal-baseline-ms: {ms}ms; --tok-step: {s}ms; --tok-fade-dur: {d}ms;"` and `data-streaming-mode={mode}` on the row container element. (`--reveal-count` is *not* bound on the container — no CSS rule consumes it; the field is computed and stored on `tokenRevealCss` for any future container-query use, but emitting it as a CSS variable on every render would be dead computation.)
  - **R8 (accessibility):** ensure the assistant-row container carries `aria-live="polite"` and `role="log"` (or whatever the existing assistant-message wrapper already provides — verify existing semantics during implementation and preserve them). Words are always in the DOM with opacity-only gating; AT receives full text immediately. No per-word `aria-hidden` toggling. Test asserts `aria-live` attribute survives the refactor.
  - Snippet shape: unconditional snippet definition (no `{#if}` wrapping the `{#snippet}` per the Svelte 5 lesson); conditional behaviour lives inside the snippet body.
  - **No RAF.** The CSS animation drives time. The TS layer only updates `revealCount` and `baselineMs` when `tokenStream.revision` advances — and that's already reactive via the canonical projection's revision counter.

  **Execution note:** Test-first.

  **Patterns to follow:** Existing `renderAssistantBlock` snippet structure in `agent-panel.svelte` and `scene-content-viewport.svelte`. `getRowTokenStream` accessor pattern (Unit 4).

  **Test scenarios:**
  - Happy path: render a row with `tokenStream.wordCount = 10` → container has correct `tokenRevealCss.revealCount` value on the snippet context.
  - Happy path: row with `firstDeltaProducedAtMs - rustAnchorMs = 100ms` and `performance.now() - browserAnchorMs = 100ms` → `--reveal-baseline-ms: 0ms`.
  - Cold-restore: row whose `rustElapsedMs = 100ms` (delta produced 100ms after rust session-start) but `browserElapsedMs = 60000ms` (browser session-start was 60s ago) → `--reveal-baseline-ms: -59900ms` → all `.tok` spans render at full opacity (animation already elapsed).
  - Live + recreated DOM: a new `applyAssistantTextDelta` arrives → derived re-runs → `{@html}` replaces innerHTML → all old `.tok` spans destroyed and recreated → recreated spans whose effective delay is past 0 snap to settled via negative `animation-delay`; only the trailing words animate.
  - Mode flip: `chatPreferencesStore.streamingAnimationMode = "instant"` → container has `data-streaming-mode="instant"` → CSS rule disables animation.
  - GOD: rendering when canonical `tokenStream` is null returns the pure non-streaming markdown HTML (no CSS props set, no animation, full text visible).
  - Accessibility (R8): row container carries `aria-live="polite"`; words are present in the DOM tree from initial render (assertion via accessible-name query, not CSS).
  - No-performance fallback: with `globalThis.performance` undefined, the row renders without CSS props and shows full text immediately (no broken `Date.now()`-based baseline).

  **Verification:** vitest passes; `bun run check` and `bun run check:svelte` pass; the live agent panel renders the repro-lab visual on real streaming sessions.

- [ ] **Unit 8: Streaming repro lab refactored to feed the new envelope shape**

  **Goal:** Repro lab drives `AssistantTextDelta` envelopes through a mock router to exercise the new pipeline end-to-end.

  **Requirements:** R1, R2 (deterministic harness), R10

  **Dependencies:** Unit 4, Unit 7

  **Files:**
  - Modify: `packages/desktop/src/lib/acp/components/debug-panel/streaming-repro-controller.ts`
  - Modify: `packages/desktop/src/lib/acp/components/debug-panel/streaming-repro-graph-fixtures.ts`
  - Modify: `packages/desktop/src/lib/acp/components/debug-panel/streaming-repro-lab.svelte`
  - Test: `packages/desktop/src/lib/acp/components/debug-panel/__tests__/streaming-repro-lab-token-stream.svelte.vitest.ts`

  **Approach:**
  - Replace the local `projectAgentPanelReveal` driver with a phase-to-`AssistantTextDelta`-sequence transformer. Each phase emits a sequence of one or more deltas.
  - Replace the local RAF loop with the same canonical-projection-derived snippet binding the production controller uses (Unit 7).
  - Preserve all 9 existing presets (`core-streaming`, `first-word-regression`, `final-step-fade`, `completion-snap-fade`, `restored-completed-history`, `reduced-motion`, `instant-mode`, `same-key-rewrite`, `text-resource-text`) — the visual contract is preserved.
  - The `restored-completed-history` preset now sets `firstDeltaProducedAtMs = now - 60s` to exercise the cold-restore path.
  - The `reduced-motion` preset toggles `<html data-prefers-reduced-motion="true">` (or directly via `@media`) — pick the cleaner fixture mechanism.

  **Execution note:** This is the deterministic QA harness; treat its tests as living regression contracts.

  **Patterns to follow:** Existing repro-lab phase-to-graph pattern; mirror the new envelope shape.

  **Test scenarios:**
  - Each of the 9 presets: rendering produces the expected DOM after each phase advance.
  - Happy path: `core-streaming` final phase shows full text with last-word fade in flight.
  - Edge case: `restored-completed-history` shows full text with no animation in flight (cold-restore).
  - Edge case: `reduced-motion` shows full text with `animation: none`.
  - Edge case: `instant-mode` shows full text with `animation: none`.
  - **Burst delivery:** a fixture emits 80 words in a single `AssistantTextDelta` 2 seconds after the session anchor → words 0–N where `(rustElapsed - browserElapsed + N * 32ms) > 420ms` snap to settled; only the trailing words visibly animate. Document the expected visual: a brief flash of the body followed by a smooth tail-word fade. This is the accepted production behavior for burst providers.
  - Determinism: replaying the same preset sequence twice produces identical span structure and `--reveal-baseline-ms` values at each step.
  - Cross-turn: switching from `core-streaming` to `first-word-regression` resets `tokenStream` map cleanly (different turn ids).

  **Verification:** vitest passes; manual visual check of all 9 presets in the running dev app shows the same animation as the prior repro lab.

- [ ] **Unit 9: Hard-cutover deletion — projector, RAF, action, gate, override, reparse**

  **Goal:** Delete every reader/writer the new pipeline replaces. No coexistence.

  **Requirements:** R3, R10

  **Dependencies:** Units 4, 5, 6, 7, 8

  **Files (delete or strip):**
  - Delete: `packages/desktop/src/lib/acp/components/agent-panel/logic/agent-panel-reveal-projector.ts`
  - Delete: `packages/desktop/src/lib/acp/components/agent-panel/logic/__tests__/agent-panel-reveal-projector.test.ts`
  - Modify: `packages/desktop/src/lib/acp/components/agent-panel/logic/index.ts` (remove projector exports)
  - Modify: `packages/desktop/src/lib/acp/components/agent-panel/logic/agent-panel-display-model.ts` (remove `isLiveTail`, `findLiveAssistantEntryId`, `hasLiveTail`, `requiresStableTailMount` — replaced by canonical-derived `isStreamingRow`)
  - Modify: `packages/desktop/src/lib/acp/session-state/agent-panel-graph-materializer.ts` (line 546: remove `findLiveAssistantEntryId`)
  - Modify: `packages/desktop/src/lib/acp/components/agent-panel/components/agent-panel.svelte` (delete: reveal RAF lines 200–237, `prefersReducedMotion` state, `presentationSessionStateGraph` terminal-override branch lines 466–481, `effectiveTurnPresentation`, `agentPanelRevealMemory`, `agentPanelRevealResult` derived line 863–879)
  - Modify: `packages/desktop/src/lib/acp/components/messages/markdown-text.svelte` (delete `canonicalStreamingWordFade` action lines 528–604, `{#key streamingHtml}` block lines 740–748, all `streamingAnimationMode` JS branches, `isRenderingPartialText` and `isStreaming` props)
  - Modify: `packages/ui/src/components/agent-panel/agent-assistant-message-visible-groups.ts` (delete `shouldStreamAssistantTextContent`; replace with `currentStreamingGroupIndex` derived from `tokenStream.totalChars`)
  - Modify: `packages/ui/src/components/agent-panel/agent-assistant-message.svelte` (use new group index)
  - Modify: `packages/desktop/src/lib/acp/components/agent-panel/components/scene-content-viewport.svelte` (rewire native-fallback boolean to canonical-derived `isStreamingRow`)
  - Modify: `packages/ui/src/components/markdown/markdown-prose.css` (delete `.sd-word-fade`, `@keyframes sd-fadeIn`)
  - Update: any test file that referenced the deleted symbols

  **Approach:**
  - Sequenced deletion: delete projector and its test, then chase down references via `bun run check:svelte` until clean.
  - For each deleted symbol, confirm via grep there are no remaining importers before deletion.
  - Replace `shouldStreamAssistantTextContent` with a deterministic `currentStreamingGroupIndex(groups, tokenStream): number` derived from `tokenStream.accumulatedText.length` against per-group character spans (each group already carries a contiguous text region; the index is the largest group whose start char ≤ accumulated length). Lives in the same file as the deleted heuristic. Test: a 3-group fixture with `accumulatedText.length` advancing through each group's char range produces correct group indices.
  - The `requiresStableTailMount` boolean survives in spirit but is renamed `isStreamingRow` and derived as `canonical.turnState === "Running" && rowId === canonical.lastAgentRowId`.

  **Execution note:** Run `bun run check:svelte` after each deletion. Per `agent-panel-content-viewport-reactivity-renderer-2026-05-01`, Svelte component type errors are invisible to plain `tsc`.

  **Patterns to follow:** Prior hard-cutover deletions in the GOD migration (e.g., `ToolCallManager` deletion).

  **Test scenarios:**
  - Group index: 3-group fixture with `accumulatedText.length` at 0, mid-group-1, mid-group-2, end-group-3 returns indices 0, 0, 1, 2 respectively (test of the new replacement function).
  - Other deletions: pure code removal — verification is "all prior tests deleted, all references resolved, all checks green, repro lab still works visually."

  **Verification:** `bun run check`, `bun run check:svelte`, `bun test` all green; grep shows zero references to `projectAgentPanelReveal`, `canonicalStreamingWordFade`, `shouldStreamAssistantTextContent`, `isLiveTail`, `findLiveAssistantEntryId`, `presentationSessionStateGraph`, `{#key streamingHtml}`; live dev-app smoke pass shows the repro-lab fade on real Claude / Codex / Cursor / Copilot / Opencode sessions.

- [ ] **Unit 10: Replay-equality determinism harness**

  **Goal:** Automated test that proves R2 — the same envelope log produces structurally identical span trees and identical `--reveal-baseline-ms` values across runs and across cold-restore vs live.

  **Requirements:** R2, R6

  **Dependencies:** Units 1–9

  **Files:**
  - Create: `packages/desktop/src/lib/acp/__tests__/streaming-replay-determinism.vitest.ts`

  **Approach:**
  - Fixture: a recorded envelope log of ~50 deltas across 3 turns of mixed providers.
  - Test 1 (replay equality): apply the log twice through `applySessionStateEnvelope` against fresh stores; render via the production snippet; assert structural span equivalence (same `.tok` count, same `--i` values, same `--reveal-baseline-ms` per row). Use a stable serializer that normalizes attribute ordering.
  - Test 2 (cold-restore equivalence): apply the same log once "live" (browser anchor and rust anchor both near now) and once "cold" (rust deltas in the past, browser anchor at apply time); assert span structures are identical (only `--reveal-baseline-ms` differs in numeric value, by design — the cold-restore baseline is strongly negative).
  - Test 3 (cross-turn isolation): two turns sharing a `rowId` produce two separate streams; rendering shows both rows with independent `--reveal-baseline-ms` and independent span trees.
  - Test 4 (sparse provider): log including a no-`message_id` codex sequence — synthesized `rowId` present, stream coherent.

  **Execution note:** This is the bedrock R2 contract test. Treat its pass/fail as merge-blocking forever.

  **Patterns to follow:** Existing `session-store-projection-state.vitest.ts` round-trip pattern.

  **Test scenarios:**
  - Replay equality: same log, two runs, structurally identical span trees with equal `--i` and `--reveal-baseline-ms`.
  - Cold vs live: same log, different anchor pairs, identical span structure (only `--reveal-baseline-ms` numeric value differs as designed).
  - Cross-turn isolation: same `rowId` across two turns, two separate streams.
  - Sparse provider: log including a no-`message_id` codex sequence, synthesized `rowId` present, stream coherent.

  **Verification:** vitest passes; treated as merge-blocking forever.

## System-Wide Impact

- **Interaction graph:** `AssistantTextDelta` flows through the same envelope pipeline as existing payloads (Snapshot/Delta/Lifecycle/Capabilities/Telemetry/Plan). No new IPC channel, no new event name. The router gains one branch.
- **Error propagation:** Per `neverthrow`, `applyAssistantTextDelta` returns `Result<void, ApplyError>`; malformed payloads propagate as `Result.err` and are logged via the existing envelope-error path.
- **State lifecycle risks:**
  - **Mid-turn store reset.** The existing canonical `replaceGraph` command must clear `tokenStream` entries for the session (mirrored after how transcript snapshots are cleared). Unit 4 covers this.
  - **Cross-turn contamination.** Composite key `(turnId, rowId)` makes this architecturally inert. Tested in Unit 4 and Unit 10.
  - **Reconnect duplicate deltas.** Idempotent `charOffset` guard in Unit 4 absorbs replays cleanly.
  - **No-`message_id` providers.** Synthesized id at Rust edge (Unit 2). Tested in Unit 2.
- **API surface parity:** No public TS or Rust API changes outside the envelope pipeline. The `AgentAssistantEntry.markdown` prop on `@acepe/ui` continues to carry the rendered HTML string; the only addition is a new `tokenRevealCss` field on `AssistantRenderBlockContext`.
- **Integration coverage:**
  - End-to-end vitest in Unit 7 proves envelope arrival → DOM span tree advances and `--reveal-baseline-ms` updates.
  - Replay-determinism in Unit 10 proves R2 across cold-restore and live.
  - Repro lab in Unit 8 covers the 9 visual phases as living QA.
  - Live dev-app smoke pass on all 5 providers (Claude, Codex, Copilot, Cursor, Opencode) is verification gate before merge.
- **Unchanged invariants:**
  - The transcript spine (`transcriptSnapshot`, `TranscriptDelta`) remains the order/history authority. `tokenStream` is a parallel cosmetic projection and never substitutes for transcript truth.
  - Tool-call streaming, permission prompts, plan messages remain unchanged.
  - Persistent journal (covered by `2026-05-05-001`) is not touched.
  - The `check-diagnostic-import-boundary.ts` lint script continues to keep diagnostics off product imports; the repro lab refactor must pass that check.

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| markdown-it word-wrap plugin breaks an unanticipated rendering case (lists, blockquotes, nested formatting). | Comprehensive plugin tests in Unit 5 covering all common markdown shapes; visual smoke pass on existing Acepe message corpus before merge. |
| Word-count parity between TS controller and markdown-it plugin diverges (controller says 47 words, plugin emitted 48 spans). | The plugin exports `countWordsInMarkdown(text)` which walks the same markdown-it Token tree using the same grouping algorithm. Unit 4 stores the result on `RowTokenStream.wordCount` directly so the controller never independently counts. Parity by construction; asserted on a 20-message fixture corpus.
| Clock-epoch mismatch between Rust `Instant` and browser `performance.now()`. | Per-session `(rustAnchorMs, browserAnchorMs)` pair captured on first delta arrival on the TS side, stored on `CanonicalSessionProjection.clockAnchor`. All baselines computed as `(rustElapsed - browserElapsed)` against these anchors. Unit 4 tests verify anchor-set-once behavior; Unit 7 tests verify the math for live and cold-restore cases. |
| Virtua row recycling crashes on the new snippet shape (`agent-panel-virtualized-reveal-crash` regression class). | Unit 7 keeps the unconditional snippet pattern; Unit 9 retains the native-fallback boolean (renamed) so virtualization behaves identically during streaming. |
| Sparse Copilot deltas (no `message_id`, no `options`) reach TS as malformed. | Unit 2 normalizes at the Rust adapter edge; Unit 4 rejects malformed envelopes with logged anomalies. Contract tests in both units cover sparse fixtures explicitly. |
| Cursor's composite tool-call ID newline normalization regression class touches the new path if `rowId` ever contains control chars. | Unit 3 sanitizes `rowId` at envelope emission idempotently; Unit 4 round-trip test asserts the sanitization holds. |
| Animation appears too slow / too fast in real-world sessions vs the repro lab. | The constants 32 ms / 420 ms come from the existing `REVEAL_TOKEN_INTERVAL_MS` and `REVEAL_FADE_DURATION_MS`. They are CSS-var-future-proof so user preferences can tune them later without code changes. |
| Hard cutover ships a regression that hides the assistant text entirely. | Per `2026-05-07-001` cosmetic-projector lesson: the renderer falls back to "show full text immediately" when CSS props are unset (no `--reveal-baseline-ms` on container ⇒ `.tok` animation begins at delay 0 with `animation-fill-mode: backwards`, but if `tokenStream` is null the rendered HTML is plain markdown with no `.tok` spans at all ⇒ full text visible). Tested in Unit 7 GOD scenario. Rollback protocol (full PR revert) is the contingency for logic regressions.
| `bun run check` passes but `bun run check:svelte` fails (Svelte type errors invisible to `tsc`). | Per `agent-panel-content-viewport-reactivity-renderer-2026-05-01`: every unit's verification step explicitly runs both `check` and `check:svelte`. |
| Replay-determinism test in Unit 10 is brittle to insignificant whitespace differences. | The Unit 10 assertion is structural — same `.tok` count per row, same `--i` value per span, same `--reveal-baseline-ms` per row. HTML attribute ordering and inter-element whitespace are normalized via a stable serializer; byte-identity is not asserted. |
| Provider-side regression introduces non-monotonic timestamps. | Unit 2 tests assert non-decreasing timestamps per parser. Unit 10 includes a deliberately out-of-order fixture and asserts the projection still produces a coherent stream (later-arriving earlier-`charOffset` deltas are dropped as stale per Unit 4 idempotency). |

## Documentation / Operational Notes

- Update `docs/solutions/architectural/final-god-architecture-2026-04-25.md` with a new section: "TokenStream is canonical (Round 6 widening)" — citing Unit 4 as the canonical authority for streaming text reveal.
- Update `CLAUDE.md` / `AGENTS.md` if any phrasing about reveal projection, RAF, or streaming animation needs to reflect the new architecture.
- After merge, write a learning note in `docs/solutions/best-practices/` titled "Token-stream + CSS reveal architecture (2026-05-09)" capturing: the decision to put pacing in CSS, the per-session `(rustAnchor, browserAnchor)` clock-alignment trick, the negative-`animation-delay` cold-restore behavior, the markdown-it core-rule plugin pattern, and the replay-equality contract.
- **Operational rollout:** hard cutover, no flag. The new pipeline lands in a single PR with all 10 units. Live dev-app smoke pass on all 5 providers (Claude, Codex, Copilot, Cursor, Opencode) is the merge gate.
- **Rollback protocol:** full-PR revert. The 10 units are sequenced for atomic-commit deletion in Unit 9, but the PR is squash-merged and reverted as one unit. Pre-merge: maintainer confirms the dev-app smoke pass shows the repro-lab fade on each provider. Post-merge regression discovery within 24h: revert PR, file an issue with the failing scenario, and re-plan from this document. The CSS fallback (missing custom props ⇒ no animation, full text visible) covers wiring failures but not logic regressions; rollback is the contingency for logic failures.

## Sources & References

- **Origin conversation:** session checkpoint 005 (`/Users/alex/.copilot/session-state/9e1bccbf-6880-4368-8a66-ecaa8c0884e1/checkpoints/005-investigating-streaming-fade-a.md`) — captures the GOD-mode reflection and Option 6 design that produced this plan.
- **Predecessor plans (superseded by this one):**
  - `docs/plans/2026-04-15-004-refactor-streaming-word-fade-redesign-plan.md` (closest prior design — CSS-driven word fade)
  - `docs/plans/2026-05-07-001-refactor-cosmetic-reveal-projector-plan.md` (reveal as cosmetic projection principle)
  - `docs/plans/2026-05-07-002-refactor-reveal-fade-cleanup-contract-plan.md` (separated `isAdvancing` from `shouldFade`)
  - `docs/plans/2026-05-08-001-fix-streaming-reveal-pacing-plan.md` (last attempt at fixing the projector)
- **Regression class plans (lessons honoured):**
  - `docs/plans/2026-04-18-001-fix-assistant-streaming-cross-turn-contamination-plan.md`
  - `docs/plans/2026-04-25-001-fix-agent-panel-virtualized-reveal-crash-plan.md`
  - `docs/plans/2026-05-02-003-fix-agent-panel-send-reveal-regression-plan.md`
  - `docs/plans/2026-05-05-001-fix-streaming-session-state-incident-plan.md`
- **Architectural anchors:**
  - `docs/solutions/architectural/final-god-architecture-2026-04-25.md`
  - `docs/solutions/architectural/canonical-projection-widening-2026-04-28.md`
- **UX/UI lessons:**
  - `docs/solutions/ui-bugs/assistant-text-reveal-streaming-block.md`
  - `docs/solutions/best-practices/agent-panel-content-viewport-reactivity-renderer-2026-05-01.md`
  - `docs/solutions/best-practices/svelte5-unconditional-snippet-props-2026-04-12.md`
  - `docs/solutions/best-practices/reactive-state-async-callbacks-svelte-2026-04-15.md`
- **Provider lessons:**
  - `docs/solutions/integration-issues/copilot-permission-prompts-stream-closed-2026-04-09.md`
  - `docs/solutions/integration-issues/2026-04-30-cursor-acp-tool-call-id-normalization-and-enrichment-path.md`
- **Repro lab plan:** `docs/plans/2026-05-04-001-feat-streaming-repro-lab-plan.md`
