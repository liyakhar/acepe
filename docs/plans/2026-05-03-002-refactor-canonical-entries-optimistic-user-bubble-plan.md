---
title: "refactor: Canonical agent panel entries with optimistic local user bubble"
type: refactor
status: active
date: 2026-05-03
---

# refactor: Canonical agent panel entries with optimistic local user bubble

## Overview

Make the canonical transcript projection the only writer of canonical conversation entries while preserving immediate chat-app-grade UX through a local optimistic user bubble rendered outside canonical transcript state.

This replaces the earlier tail-chip-only approach. The user should see a normal user message bubble immediately on send, but that bubble must live in transient local presentation state and disappear deterministically when the canonical user entry with the matching `attemptId` arrives.

## Problem Frame

The current Acepe bug is not just "slow visual feedback." It is a dual-writer ordering problem.

Today the frontend can synthesize optimistic user entries into the same conversation state that the Rust transcript projection later writes canonically into. That creates race-dependent outcomes:
- canonical user can land after assistant output
- text-equality reconciliation can fail
- repeated prompts and image-only prompts are fragile
- the viewport and reveal layers inherit a non-deterministic substrate

The previous plan fixed this by removing optimistic list entries entirely and replacing them with `pendingSendIntent` plus a tail chip. That is architecturally cleaner than today's state, but it is a UX downgrade compared with strong chat products and with the `t3code` reference flow.

The better design is:
- canonical transcript remains the sole writer of canonical entries
- optimistic send feedback is a full local user bubble
- optimistic bubble is rendered outside canonical transcript state
- reconciliation uses opaque correlation (`attemptId`), never text matching

## Requirements Trace

- R1. Canonical transcript projection is the sole writer of canonical conversation entries.
- R2. Canonical user-before-assistant ordering is deterministic for first prompts and subsequent prompts.
- R3. The user sees an immediate full user message bubble on send, not only a chip or status hint.
- R4. The optimistic bubble is local presentation state only and never mutates canonical transcript state.
- R5. The optimistic bubble disappears deterministically when the canonical user entry with matching `attemptId` arrives.
- R6. No text-equality reconciliation remains in the send path.
- R7. Text-only, mixed, and image-only sends all reconcile correctly.
- R8. Send failure clears local optimistic state immediately and restores input state as needed.
- R9. Pre-session first-send optimistic behavior remains supported.
- R10. Existing streaming and reveal layers consume a deterministic ordered substrate.

## Scope Boundaries

In scope:
- Rust `attempt_id` round-trip on prompt send, synthetic user update, and canonical transcript entry.
- Rust image-only synthetic canonical representation with stable placeholder text.
- Rust same-session ordering verification and pre-reservation eligibility for `UserMessageChunk`.
- Frontend removal of optimistic writes into canonical entry state.
- Frontend local optimistic full-bubble rendering for in-session sends.
- Reuse or adaptation of the existing optimistic agent-panel seam where it helps.
- Tests rewritten around canonical-plus-local-overlay architecture.

Out of scope:
- Broader redesign of VList/native fallback behavior.
- Removing reveal projector or follow controller.
- First-class canonical non-text transcript attachments.
- Multi-send queue UX. One in-flight send remains the contract.

## Context & Research

### Relevant Code and Patterns

- `packages/desktop/src/lib/acp/store/services/session-messaging-service.ts`
  - currently sets `pendingSendIntent`
  - currently writes optimistic user entries into canonical-style session entries via `entryManager.addEntry`
- `packages/desktop/src/lib/acp/store/api.ts`
  - current `sendPrompt` boundary does not yet carry `attemptId`
- `packages/desktop/src/lib/utils/tauri-client/acp.ts`
  - current `send_prompt` invoke payload does not yet carry `attemptId`
- `packages/desktop/src/lib/acp/store/session-entry-store.svelte.ts`
  - currently applies canonical transcript deltas
  - still contains text-based optimistic reconciliation via `findMirroredOptimisticUserEntryIndex`
- `packages/desktop/src/lib/acp/store/session-store.svelte.ts`
  - currently clears `pendingSendIntent` from lifecycle/turn-state resolution instead of canonical user-entry match
- `packages/desktop/src/lib/acp/store/panel-store.svelte.ts`
  - already has `pendingUserEntry` transient optimistic support for pre-session first send
- `packages/desktop/src/lib/acp/components/agent-panel/components/agent-panel.svelte`
  - already threads optimistic entry state into graph materialization
- `packages/desktop/src/lib/acp/session-state/agent-panel-graph-materializer.ts`
  - already supports `optimistic.pendingUserEntry`
  - currently appends it after canonical conversation rows
- `packages/desktop/src/lib/acp/components/agent-panel/logic/select-optimistic-user-entry-for-graph.ts`
  - currently infers optimistic entries by scanning session entries for non-graph user entries
- `packages/desktop/src-tauri/src/acp/commands/interaction_commands.rs`
  - emits synthetic `UserMessageChunk` after successful prompt send
- `packages/desktop/src-tauri/src/acp/pending_prompt_registry.rs`
  - owns synthetic user prompt tracking and provider-echo dedupe
- `packages/desktop/src-tauri/src/acp/transcript_projection/runtime.rs`
  - maps `UserMessageChunk` into canonical transcript append operations

### External Reference

`t3code` uses:
- canonical server messages as the main source
- a separate local optimistic user message list
- render-time merge only
- removal of optimistic copy when server message with same id arrives

Acepe should adopt the same UX shape, but use `attemptId` rather than shared message id as the reconciliation key.

## Key Technical Decisions

- Canonical transcript remains the only writer of canonical conversation entries.
- Optimistic send UI becomes a full local user bubble, not a chip-only affordance.
- Optimistic bubble is rendered from transient local state and never written into `session-entry-store`.
- `attemptId` is the only correlation key for optimistic dismissal and canonical handoff.
- Text matching is removed from optimistic dismissal and duplicate suppression logic; legacy provider-echo handling must not reintroduce a second user-entry reconciliation mode.
- Existing pre-session `panelStore.pendingUserEntry` remains the pre-session mechanism.
- In-session optimistic bubble should be sourced from session-local transient state, not from canonical-style `SessionEntry[]`.
- Success-path clearing for the in-session optimistic bubble must be driven by `canonical transcript contains matching attemptId`, not by lifecycle, turn-state, or generic running/completed transitions.
- The existing graph materializer optimistic seam should be reused where possible, but its source-of-truth changes from "scan session entries for optimistic rows" to "explicit local optimistic send state."
- The minimum-change default is to extend existing transient state (`pendingSendIntent`) and reuse the existing optimistic graph seam before introducing any dedicated optimistic-send DTO.
- Rust canonical pipeline must still be completed first so canonical arrival is deterministic and image-only sends produce canonical user entries.
- One in-flight send per session remains the contract.

## Open Questions

### Resolved During Planning

- Should Acepe keep the tail-chip-only UX?
  - No. Replace it with a local optimistic full user bubble.
- Should Acepe copy `t3code` literally?
  - No. Match its UX shape, but use `attemptId` rather than server message id as the join key.
- Should optimistic state write into canonical entry storage?
  - No. Local presentation state only.

### Deferred to Implementation

- Whether the in-session optimistic render payload is best modeled as an enriched `pendingSendIntent` or as a dedicated optimistic-send DTO in transient session state.
- Whether the existing `optimistic.pendingUserEntry` graph-materializer input should stay `SessionEntry`-shaped or become a dedicated optimistic user model.
- Whether `selectOptimisticUserEntryForGraph` should be deleted outright or rewritten as an explicit attemptId-driven selector.

### Resolved by review gate

- Frontend `attemptId` transport cannot be deferred behind Rust-only work.
  - The send boundary must be updated end-to-end in Unit 1 so Rust actually receives the correlation id.
- Success-side optimistic clearing cannot remain lifecycle-driven.
  - Existing lifecycle/turn-state-based `pendingSendIntent` clearing must be replaced for the in-session optimistic path with a canonical-attemptId match rule.
- Bubble handoff needs explicit visible continuity rules.
  - No duplicate bubble, no visible flicker, and no unexplained disappearance are part of acceptance, not optional polish.

## High-Level Technical Design

> This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.

```text
User clicks Send
  -> frontend creates local optimistic send state:
     { attemptId, createdAt, prompt display payload, image preview payload }
  -> agent panel renders optimistic full user bubble from that local state
  -> frontend sends prompt with attemptId
  -> Rust emits synthetic UserMessageChunk with same attempt_id
  -> transcript projection appends canonical user entry with same attempt_id
  -> session graph includes canonical user entry
  -> UI selector sees canonical user entry with matching attemptId
  -> optimistic bubble is omitted next render
  -> only canonical user entry remains visible
```

Determinism comes from the split:
- canonical order is owned by Rust transcript sequencing only
- optimistic visibility is owned by a pure local predicate keyed by `attemptId`

Visible handoff contract:
- the optimistic bubble appears on the next render after send is accepted locally
- the optimistic bubble remains visible until either a matching canonical user entry is present or the send fails
- canonical handoff must not show duplicate user bubbles for the same `attemptId`
- canonical handoff must not introduce visible flicker or unexplained disappearance
- for image-only sends, implementation must explicitly choose whether visual continuity is preserved across handoff or the canonical `"[Image]"` representation is an acceptable downgrade, and tests must assert that choice
- if the user is detached from the tail, optimistic render and canonical handoff must not steal scroll position

## Implementation Units

- [x] **Unit 1: Complete canonical Rust prompt correlation pipeline**

**Goal:** Ensure Rust canonically emits and projects user sends with deterministic ordering and stable `attempt_id` correlation.

**Requirements:** R1, R2, R5, R7

**Dependencies:** None

**Files:**
- Modify: `packages/desktop/src/lib/acp/store/api.ts`
- Modify: `packages/desktop/src/lib/utils/tauri-client/acp.ts`
- Modify: `packages/desktop/src-tauri/src/acp/types.rs`
- Modify: `packages/desktop/src-tauri/src/acp/commands/interaction_commands.rs`
- Modify: `packages/desktop/src-tauri/src/acp/pending_prompt_registry.rs`
- Modify: `packages/desktop/src-tauri/src/acp/session_update/types/session_update.rs`
- Modify: `packages/desktop/src-tauri/src/acp/session_update/deserialize.rs`
- Modify: `packages/desktop/src-tauri/src/acp/transcript_projection/runtime.rs`
- Modify: `packages/desktop/src-tauri/src/acp/transcript_projection/snapshot.rs`
- Modify: `packages/desktop/src-tauri/src/acp/pre_reservation_event_buffer.rs`
- Modify: `packages/desktop/src-tauri/src/acp/ui_event_dispatcher.rs`
- Test: Rust unit/integration tests in the touched ACP modules

**Approach:**
- Update the frontend invoke seam first so `sendPrompt` carries `attemptId` into `acp_send_prompt`.
- Add `attempt_id` to prompt request, synthetic user update, and canonical transcript entry shape.
- Keep image-only canonical user entries alive via stable `"[Image]"` placeholder text.
- Keep provider-echo dedupe aligned with `attempt_id` without reintroducing text-based user-entry reconciliation as a second steady-state path.
- Verify same-session persistence/projection ordering for synthetic user vs assistant updates.
- Ensure `UserMessageChunk` is valid in the pre-reservation buffer path.

**Patterns to follow:**
- Existing `UserMessageChunk -> AppendEntry` transcript projection flow
- Existing per-session ordering tests and dispatcher locking shape

**Test scenarios:**
- Happy path: text prompt round-trips one `attempt_id` from send request to canonical user transcript entry.
- Happy path: image-only prompt emits a canonical user entry with `"[Image]"`.
- Edge case: mixed text plus image prompt preserves joined display text deterministically.
- Edge case: repeated identical prompt text still correlates by `attempt_id`, not text.
- Error path: provider echo without matching attempt id still falls back safely to existing behavior where needed.
- Integration: concurrent synthetic user and assistant updates for the same session still yield canonical user-before-assistant ordering.

**Verification:**
- Canonical user transcript entries visibly carry `attemptId` in generated TS types and Rust transcript serialization.
- Frontend `sendPrompt` transport visibly carries `attemptId` into the Tauri command boundary.
- Ordering tests prove no user-below-assistant regression for the canonical path.

- [x] **Unit 2: Remove optimistic writes from canonical session entry state**

**Goal:** Stop frontend send flow from mutating canonical-style session entry storage during optimistic send.

**Requirements:** R1, R4, R6

**Dependencies:** Unit 1

**Files:**
- Modify: `packages/desktop/src/lib/acp/store/services/session-messaging-service.ts`
- Modify: `packages/desktop/src/lib/acp/store/session-entry-store.svelte.ts`
- Modify: `packages/desktop/src/lib/acp/store/__tests__/session-entry-store-streaming.vitest.ts`
- Modify: `packages/desktop/src/lib/acp/store/services/__tests__/session-messaging-service-send-message.test.ts`

**Approach:**
- Remove optimistic `entryManager.addEntry` on send.
- Remove text-based optimistic reconciliation in `applyTranscriptDelta`.
- Keep canonical delta application pure.
- Preserve send failure handling and one-in-flight-send behavior.

**Patterns to follow:**
- Existing canonical delta flow in `session-entry-store`
- Existing send failure rollback behavior in `session-messaging-service`

**Test scenarios:**
- Happy path: send sets local pending state but does not append a canonical-style session entry immediately.
- Happy path: canonical append entry lands without any text-based reconciliation path.
- Edge case: identical repeated prompts do not trigger false reconciliation.
- Error path: send failure clears pending send state and restores input-affecting state.
- Integration: late canonical user append after assistant activity no longer depends on optimistic row replacement.

**Verification:**
- No optimistic user send path writes into `session-entry-store` before canonical delta arrival.
- No text-equality reconciliation remains in `session-entry-store`.

- [x] **Unit 3: Introduce explicit in-session optimistic user bubble state**

**Goal:** Represent an in-session optimistic user message as transient local presentation state keyed by `attemptId`.

**Requirements:** R3, R4, R5, R8

**Dependencies:** Unit 2

**Files:**
- Modify: `packages/desktop/src/lib/acp/store/types.ts`
- Modify: `packages/desktop/src/lib/acp/store/services/session-messaging-service.ts`
- Modify: `packages/desktop/src/lib/acp/store/session-store.svelte.ts`
- Modify: `packages/desktop/src/lib/acp/store/__tests__/session-store-projection-state.vitest.ts`
- Modify: `packages/desktop/src/lib/acp/store/__tests__/transient-projection.test.ts`

**Approach:**
- Extend transient session send state so it carries renderable optimistic user bubble data, not just a timing hint. Default to enriching `pendingSendIntent` unless implementation proves that is insufficient.
- Include `attemptId`, created-at time, display text, and image preview metadata needed for immediate UI rendering.
- Keep pre-session first-send behavior separate from in-session send behavior.
- Clear optimistic state on failure immediately, not on timeout fallback.
- Replace existing success-path lifecycle/turn-state-based clearing for the in-session optimistic path with a canonical-match predicate keyed by `attemptId`.
- Explicitly define failure UX: original draft text and image selections are restored, an error surface remains visible, and the send never appears to vanish silently.

**Patterns to follow:**
- Existing `pendingSendIntent` lifecycle
- Existing transient hot-state projection patterns
- Existing `panelStore.pendingUserEntry` as the pre-session precedent

**Test scenarios:**
- Happy path: send creates renderable optimistic local bubble state immediately.
- Happy path: image send includes preview-capable optimistic metadata.
- Edge case: text-only empty prompt plus images still creates a valid optimistic bubble.
- Error path: send failure clears optimistic state within one update cycle.
- Error path: timeout/lifecycle rejection does not leave a ghost optimistic bubble.
- Integration: lifecycle or turn-state transitions without a canonical matching user entry do not clear the optimistic in-session bubble.

**Verification:**
- Session hot state can fully describe an optimistic in-session user bubble without writing into canonical entry state.
- Existing pending send lifecycle still enforces one active send.
- In-session optimistic state is not cleared on success until a matching canonical user entry is present.

- [x] **Unit 4: Render the optimistic user bubble through the agent-panel graph path**

**Goal:** Show a full optimistic user bubble in the conversation surface using explicit local optimistic state, then hand off to canonical arrival deterministically.

**Requirements:** R3, R4, R5, R9

**Dependencies:** Unit 3

**Files:**
- Modify: `packages/desktop/src/lib/acp/components/agent-panel/components/agent-panel.svelte`
- Modify: `packages/desktop/src/lib/acp/session-state/agent-panel-graph-materializer.ts`
- Modify: `packages/desktop/src/lib/acp/components/agent-panel/logic/select-optimistic-user-entry-for-graph.ts`
- Modify: `packages/desktop/src/lib/acp/session-state/__tests__/agent-panel-graph-materializer.test.ts`
- Modify: `packages/desktop/src/lib/acp/components/agent-panel/logic/__tests__/select-optimistic-user-entry-for-graph.test.ts`
- Modify: `packages/desktop/src/lib/acp/components/agent-panel/logic/__tests__/session-status-mapper.test.ts`

**Approach:**
- Keep using the graph-materialization optimistic seam, but feed it explicit local optimistic send state rather than inferred session entries.
- Preserve pre-session `panelStore.pendingUserEntry` handling.
- For in-session sends, render the optimistic user bubble when local optimistic send exists and no canonical graph user entry with matching `attemptId` exists.
- Omit the optimistic bubble immediately once canonical match is present.
- Preserve existing warming/running presentation rules.
- Specify viewport continuity rules for send, optimistic display, canonical handoff, and failure so the optimistic bubble does not cause double-scroll, tail theft, or visual jump.
- Explicitly define pre-session to in-session ownership transfer so first-send session creation cannot double-render or drop the bubble.

**Patterns to follow:**
- Existing `optimistic.pendingUserEntry` graph-materializer input path
- Existing `isOptimistic` conversation entry rendering
- Existing pre-session optimistic tests

**Test scenarios:**
- Happy path: graph present plus pending in-session optimistic send renders canonical entries plus optimistic user bubble as final row.
- Happy path: graph absent or pre-session still renders optimistic first-send bubble correctly.
- Edge case: assistant output from prior turn does not hide or reorder the optimistic user bubble.
- Edge case: repeated prompt text does not affect optimistic selection because dismissal is by `attemptId`.
- Integration: canonical user entry with matching `attemptId` suppresses optimistic bubble on next render with no duplication.
- Integration: canonical user entry with different `attemptId` does not suppress the current optimistic bubble.
- Integration: accepted send with delayed canonical arrival keeps the optimistic bubble visible without flicker or duplicate rows.
- Integration: first-send session creation transfers ownership from pre-session optimism to in-session/canonical state without duplicate or dropped bubble.
- Integration: detached viewport does not auto-follow during optimistic render or canonical handoff.

**Verification:**
- Agent panel shows immediate full user bubble on send without any canonical store mutation.
- Canonical handoff removes the optimistic bubble deterministically.
- No visible duplicate, flicker, or unexplained disappearance occurs during optimistic-to-canonical handoff.

- [ ] **Unit 5: Conditional cleanup of dead aggregator-era helpers and tests**

**Goal:** After Units 1-4 land, remove only the stale helper/test paths proven unnecessary by the shipped architecture.

**Requirements:** R1, R6, R10

**Dependencies:** Units 2 through 4

**Files:**
- Modify: `packages/desktop/src/lib/acp/store/services/session-messaging-service.ts`
- Modify: `packages/desktop/src/lib/acp/store/services/chunk-aggregator.ts`
- Modify: `packages/desktop/src/lib/acp/store/session-event-service.svelte.ts`
- Modify: relevant tests under `packages/desktop/src/lib/acp/store/` and `packages/desktop/src/lib/acp/logic/`
- Modify: generated/consumed transcript types if needed after Rust shape changes

**Approach:**
- Remove old optimistic-entry assumptions from tests.
- Delete or rewrite any tests that expect canonical state to absorb optimistic sends by text match.
- Remove obsolete TS-side assistant-turn boundary helpers made redundant by canonical transcript ordering.
- Keep surviving aggregator logic only if it still serves non-entry concerns.
- Treat `chunk-aggregator.ts` and `session-event-service.svelte.ts` cleanup as conditional: only touch them in this plan if Units 1-4 prove they are on the active path or their retained code actively obscures the new architecture.

**Patterns to follow:**
- Existing canonical graph and transcript tests
- Existing dead-path cleanup approach already documented in the earlier plan

**Test scenarios:**
- Happy path: streaming and scene tests operate from canonical transcript input plus explicit optimistic overlay state.
- Edge case: Cursor-style repeated assistant message ids still split canonically by event ordering.
- Edge case: image-only sends reconcile correctly without text matching.
- Integration: full send flow shows optimistic bubble immediately, then canonical user, then canonical assistant in stable order.

**Verification:**
- No remaining frontend tests depend on optimistic insertion into canonical session entry state.
- No stale helper remains whose only purpose was to repair dual-writer ordering.

## Progress Notes

- 2026-05-03: Units 1 through 4 completed.
- 2026-05-03: Unit 5 partial cleanup completed for the obsolete inferred optimistic selector path.
  - Removed `packages/desktop/src/lib/acp/components/agent-panel/logic/select-optimistic-user-entry-for-graph.ts`
  - Removed `packages/desktop/src/lib/acp/components/agent-panel/logic/__tests__/select-optimistic-user-entry-for-graph.test.ts`
- 2026-05-03: Focused verification passed after the Unit 4 graph-seam swap.
  - `bun test ./src/lib/acp/store/__tests__/session-store-projection-state.vitest.ts`
  - `bun test src/lib/acp/session-state/__tests__/agent-panel-graph-materializer.test.ts`
  - `bun test src/lib/acp/store/services/__tests__/session-messaging-service-send-message.test.ts`
  - `bun run check`

## System-Wide Impact

- Interaction graph:
  - send flow now splits clearly into canonical transcript writes and local optimistic presentation
  - graph materialization becomes the primary optimistic overlay boundary
- Error propagation:
  - send failure must clear optimistic local state immediately
  - canonical failure paths must not leave stale optimistic UI behind
- State lifecycle risks:
  - duplicate display if optimistic dismissal predicate is wrong
  - hidden optimistic bubble if canonical matching predicate is wrong
  - panel-scoped and session-scoped optimistic state must not conflict
- API surface parity:
  - generated TS transcript types must expose canonical user `attemptId`
  - all user-send callsites must pass the same attempt correlation contract
- Integration coverage:
  - send, canonical arrival, and overlay dismissal must be tested end-to-end across Rust and TS seams
  - lifecycle/turn-state updates without canonical user-entry arrival must not dismiss the optimistic bubble early

## Risks & Dependencies

- Risk: choosing the wrong local optimistic state shape causes unnecessary churn in UI layers.
  - Mitigation: prefer reuse of existing optimistic graph seam and transient state patterns.
- Risk: image-only canonical placeholder and optimistic preview UX diverge visually.
  - Mitigation: treat canonical transcript as ordering/audit spine and optimistic bubble as immediate render surface.
- Risk: duplicate user bubble if canonical arrival and optimistic dismissal do not use the same `attemptId`.
  - Mitigation: make `attemptId` propagation a hard requirement in Rust and TS types before frontend overlay work lands.
- Dependency: Rust canonical pipeline work must land before frontend optimistic overlay removal/addition can be considered complete.

## Documentation / Operational Notes

- This new plan supersedes the earlier chip-only plan and should replace it rather than coexist with it.
- If durable team knowledge is captured afterward, update the relevant UI bug learning to reflect "canonical entries plus local optimistic overlay" as the endorsed pattern.

## Sources & References

- Superseded plan: `docs/plans/2026-05-03-001-refactor-canonical-only-entry-list-plan.md`
- Acepe optimistic pre-session seam:
  - `packages/desktop/src/lib/acp/store/panel-store.svelte.ts`
  - `packages/desktop/src/lib/acp/components/agent-panel/components/agent-panel.svelte`
  - `packages/desktop/src/lib/acp/session-state/agent-panel-graph-materializer.ts`
- Acepe current dual-writer problem:
  - `packages/desktop/src/lib/acp/store/services/session-messaging-service.ts`
  - `packages/desktop/src/lib/acp/store/session-entry-store.svelte.ts`
- Rust canonical pipeline:
  - `packages/desktop/src-tauri/src/acp/commands/interaction_commands.rs`
  - `packages/desktop/src-tauri/src/acp/pending_prompt_registry.rs`
  - `packages/desktop/src-tauri/src/acp/transcript_projection/runtime.rs`
- External reference:
  - `t3code/apps/web/src/components/ChatView.tsx`
  - `t3code/apps/web/src/session-logic.ts`
