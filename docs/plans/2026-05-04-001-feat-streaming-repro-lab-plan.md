---
title: feat: Add streaming repro lab to debug panel
type: feat
status: active
date: 2026-05-04
---

# feat: Add streaming repro lab to debug panel

## Overview

Add a dev-only streaming repro lab to the existing Debug Panel so we can drive the real agent-panel content render path through deterministic scripted phases, inspect the derived runtime state in-page, and collect repeatable human QA answers about whether streaming is visually happening.

## Problem Frame

We have conflicting evidence about the current streaming bug. Tests and log-based QA say live assistant chunks are reaching the panel path, but live manual QA still reports that nothing visibly streams and the final assistant block appears only at completion. The normal app shell makes this hard to isolate because provider timing, session lifecycle, viewport state, and reveal pacing all move at once.

We need a controlled reproduction surface that uses the real desktop agent-panel rendering path, not a fake transcript demo, and lets us step through the exact classes of states that matter: optimistic user send, thinking-only wait, first assistant token, append-only growth, tool interleave, reveal-drain after semantic completion, and next-turn handoff. The goal is diagnostic confidence, not a production behavior change.

## Requirements Trace

- R1. The existing Debug Panel must expose a dev-only streaming repro lab entry that is easy to reopen during debugging.
- R2. The repro lab must drive the real desktop agent-panel content render path used by the product, not a separate fake renderer.
- R3. The repro lab must support deterministic scripted phases so the same visual sequence can be replayed repeatedly.
- R4. The repro lab must expose enough in-page evidence to separate canonical state, scene state, reveal state, and viewport state.
- R5. The repro lab must let a human tester explicitly confirm what they saw for each scripted step.
- R6. This work is debugging infrastructure only; it must not change production streaming behavior outside dev mode.

## Scope Boundaries

- No streaming behavior fix in this change.
- No new production-facing navigation, settings, or persistent user preferences.
- No second dev-only authority for session lifecycle or panel actionability.
- No provider-backed live repro in the first slice; the initial lab is deterministic and scripted.
- No redesign of the agent panel itself beyond the minimum dev-only host surface needed to render the repro lab.

## Context & Research

### Relevant Code and Patterns

- `packages/desktop/src/lib/components/main-app-view/components/overlays/app-overlays.svelte` already mounts the global `DebugPanel` overlay.
- `packages/desktop/src/lib/acp/components/debug-panel.svelte` is the current dev-only surface and the smallest host seam for the lab.
- `packages/desktop/src/lib/acp/components/agent-panel/components/agent-panel-content.svelte` is the best render seam for a faithful repro because it mounts the real `SceneContentViewport` path without the full session/panel shell coupling.
- `packages/desktop/src/lib/acp/components/agent-panel/components/scene-content-viewport.svelte` owns the real viewport, reveal-activity, auto-follow, and native-fallback behavior that manual QA is actually judging.
- `packages/desktop/src/lib/acp/session-state/agent-panel-graph-materializer.ts` is the canonical graph-to-scene producer and should remain the single scene authority for scripted repro phases.
- `packages/desktop/src/lib/acp/components/agent-panel/logic/assistant-text-reveal-projector.svelte.ts` is the reveal layer we need to preserve to reproduce real visual streaming behavior.
- `packages/desktop/src/routes/test-agent-panel/+page.svelte` is prior art for a dev/test surface around agent-panel rendering.
- `packages/desktop/src/lib/acp/components/agent-panel/components/__tests__/scene-content-viewport.svelte.vitest.ts` shows the deterministic viewport test posture and existing stubbing strategy.

### Institutional Learnings

- `docs/solutions/ui-bugs/assistant-text-reveal-streaming-block.md` says reveal pacing is a presentation lifecycle, not the same thing as canonical `isStreaming`; the lab must separate semantic phases from reveal phases.
- `docs/solutions/ui-bugs/agent-panel-graph-materialization-rendering-bug-2026-04-28.md` says the panel must render from canonical scene data, not a fake transcript-shaped fallback.
- `docs/solutions/ui-bugs/agent-panel-composer-split-brain-canonical-actionability-2026-04-30.md` says we must avoid a second authority for panel state in dev tooling.
- `docs/solutions/logic-errors/thinking-indicator-scroll-handoff-2026-04-07.md` says thinking-row handoff and reveal targeting need dedicated coverage; they are first-class repro cases.
- `docs/solutions/best-practices/reactive-state-async-callbacks-svelte-2026-04-15.md` says async phase progression should stay in a controller layer, not drift across reactive presentation code.

### Related Prior Art

- `docs/plans/2026-04-07-002-feat-reveal-debugger-page-plan.md` explored a route-based reveal debugger around `MarkdownText`. This lab is narrower and more faithful to the current bug because it targets the actual agent-panel content path inside the existing Debug Panel rather than a separate route.

## Key Technical Decisions

- **Debug-panel host, panel-faithful render surface:** Keep the lab discoverable from the existing Debug Panel, but render the repro surface inside a large panel-sized dev host rather than the current tiny dialog layout so viewport behavior remains representative.
- **Lock v1 to `AgentPanelContent`:** The first slice must mount through `AgentPanelContent`, not a thinner `SceneContentViewport` harness, so the repro preserves the real panel content wrapper and the same path humans are judging. If that seam proves insufficient, the next move is up to an `AgentPanel` or shell-level harness, not down to a thinner one.
- **Canonical-scene-driven phases:** Script repro states as ordered canonical/scene transitions and feed them into the real `AgentPanelContent -> SceneContentViewport` path. Do not mutate transcript text directly in the view.
- **Separate semantic and presentation phases:** Model steps such as thinking-only wait, live assistant append, semantic completion, and reveal drain independently so we can tell whether the bug is in canonical state, scene materialization, reveal pacing, or viewport display.
- **Explicit repro controller:** Keep phase progression, timing, presets, and QA confirmation state in a dedicated desktop-local controller module instead of embedding timers and mutable sequencing logic in Svelte markup.
- **In-page evidence over console inference:** Surface canonical inputs, scene outputs, reveal activity, viewport fallback state, and current rendered text length directly in the lab UI so manual QA can answer with evidence.
- **Deterministic first, but not diagnosis-complete until tied to a live symptom:** The first slice should ship fixed presets for the smallest high-value cases, and it should leave room for a follow-up capture/replay path from a real failing session if deterministic presets alone do not reproduce the observed live symptom.

## Open Questions

### Resolved During Planning

- **Should this be a dedicated route or an overlay?** Overlay first. The user explicitly asked for a dev overlay, and the existing Debug Panel is already wired. To avoid modal-layout false positives, the lab host should be panel-sized and controller logic should stay host-agnostic so it can move to a route later without redesign.
- **What is the faithful render seam?** `AgentPanelContent` backed by canonical-scene-derived scripted entries, because it keeps the real viewport and reveal path while avoiding unrelated session shell dependencies.
- **Should the first slice use a live provider?** No. Deterministic scripted phases are the most systematic starting point for isolating visual streaming regressions.

### Deferred to Implementation

- **Whether we need a follow-up capture-and-replay importer from raw streaming traces:** defer until the deterministic presets prove insufficient.

## High-Level Technical Design

> This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.

```text
Debug Panel
  -> Streaming Repro Lab Host
       -> Repro Controller (preset + phase machine + QA answers)
            -> scripted phase -> synthetic graph fixture builder
            -> materializeAgentPanelSceneFromGraph(...)
            -> AgentPanelContent
                 -> SceneContentViewport
                      -> real reveal + follow + fallback behavior
       -> Inspector Pane
            -> canonical state summary
            -> scene summary
            -> reveal activity summary
            -> viewport/fallback summary
            -> tester answer controls + run summary export
```

Each preset is an ordered list of phases, for example:

```text
optimistic user
-> thinking only
-> first assistant token
-> append-only assistant growth
-> semantic stream complete, reveal still active
-> completed assistant
```

The first implementation slice should only require:

```text
v1 preset set
- thinking only wait
- first assistant token
- append-only growth
- semantic completion while visual reveal is still draining
```

Follow-up presets should cover tool interleave, next-turn handoff, and fallback/follow-sensitive states after the core QA loop proves useful.

## Implementation Units

- [ ] **Unit 1: Add a deterministic repro controller and preset model**

**Goal:** Create a desktop-local controller that represents replayable streaming repro presets as ordered phases with deterministic timing and visible QA state.

**Requirements:** R3, R4, R5, R6

**Dependencies:** None

**Files:**
- Create: `packages/desktop/src/lib/acp/components/debug-panel/streaming-repro-controller.ts`
- Create: `packages/desktop/src/lib/acp/components/debug-panel/streaming-repro-presets.ts`
- Create: `packages/desktop/src/lib/acp/components/debug-panel/streaming-repro-graph-fixtures.ts`
- Test: `packages/desktop/src/lib/acp/components/debug-panel/__tests__/streaming-repro-controller.test.ts`

**Approach:**
- Model a preset as ordered semantic phases, not just strings of assistant text.
- Include explicit fields for canonical turn/activity state, graph-driving transcript/tool state, optional reveal expectations, and tester-answer metadata.
- Have each preset phase deterministically build a complete synthetic `AgentPanelGraphMaterializerInput` through a dedicated fixture builder instead of letting the UI invent loose phase-to-scene conversions.
- Keep replay controls deterministic: reset, next step, previous step, play/pause, speed, and copy-current-state.
- Store tester answers separately from phase definitions so the same preset can be replayed multiple times.
- Record the QA run context with each answer: preset name, phase index, speed, host size, theme, follow state, fallback state, and timestamp, so answers are comparable across reruns.

**Execution note:** Start with a failing test for the controller phase machine and replay controls before wiring Svelte UI.

**Patterns to follow:**
- `packages/desktop/src/lib/acp/logic/session-machine.ts`
- `packages/desktop/src/lib/acp/logic/composer-machine.ts`
- Existing deterministic logic tests under `packages/desktop/src/lib/acp/components/agent-panel/logic/__tests__/`

**Test scenarios:**
- Happy path — resetting a preset returns the controller to phase 0 with cleared transient playback state.
- Happy path — next/previous navigation moves through the preset in deterministic order without skipping phases.
- Happy path — autoplay advances using the configured speed and stops at the final phase.
- Edge case — changing presets while autoplay is active resets timing and does not leak the previous preset phase.
- Edge case — tester answers persist per phase within a session but are cleared on full reset.
- Integration — copying current repro state exports both the active preset phase and the derived inspection payload.
- Integration — exported run summary includes the QA context needed to compare one run with another.

**Verification:**
- The controller can deterministically replay a preset and report a stable inspection payload for each phase.

- [ ] **Unit 2: Build a panel-faithful streaming repro host inside the existing Debug Panel**

**Goal:** Extend the existing Debug Panel with a large dev-only host that renders the repro through the real desktop panel content path and exposes inspection controls.

**Requirements:** R1, R2, R4, R5, R6

**Dependencies:** Unit 1

**Files:**
- Modify: `packages/desktop/src/lib/acp/components/debug-panel.svelte`
- Create: `packages/desktop/src/lib/acp/components/debug-panel/streaming-repro-lab.svelte`
- Create: `packages/desktop/src/lib/acp/components/debug-panel/streaming-repro-inspector.svelte`
- Test: `packages/desktop/src/lib/acp/components/debug-panel/__tests__/streaming-repro-lab.svelte.vitest.ts`

**Approach:**
- Keep the existing Debug Panel entrypoint, but widen the layout so the lab can host a realistic panel-sized conversation surface plus an inspector column.
- Use a desktop-local harness component to feed `AgentPanelContent` with the exact contract the content path expects: `viewState.kind = "conversation"`, synthetic `sceneEntries`, scripted `turnState`, scripted `isWaitingForResponse`, and a stable `panelId`/`sessionId` pair for reset-sensitive behavior.
- Surface phase controls, active preset name, current step label, and explicit tester-answer controls such as `streaming visible`, `streaming not visible`, and `unclear`.
- Define the QA flow explicitly: v1 evidence runs are manual-step by default, answering a phase pauses progression, and autoplay is for observation/replay rather than answer capture.
- Render the tester answer history alongside the preset so repeated QA passes are comparable.

**Technical design:** *(directional guidance, not implementation specification)*

```text
Debug Panel open
-> lab host mounts keyed by open generation
-> controller reset
-> default preset phase 0 renders
-> tester steps phase
-> render settles
-> tester records verdict for that phase
-> controller stores verdict + QA context
-> export copies run summary JSON/markdown snapshot
```

**Execution note:** Start with a failing component test that proves the lab mounts from the Debug Panel and renders a preset-driven conversation surface plus inspector controls.

**Patterns to follow:**
- `packages/desktop/src/lib/acp/components/debug-panel.svelte`
- `packages/desktop/src/routes/test-agent-panel/+page.svelte`
- `packages/desktop/src/lib/acp/components/agent-panel/components/agent-panel-content.svelte`

**Test scenarios:**
- Happy path — opening the Debug Panel shows a streaming repro lab section with preset controls and a mounted conversation surface.
- Happy path — selecting a preset updates the active phase label and rendered conversation content.
- Integration — advancing a preset phase changes the conversation surface through the real `AgentPanelContent` path rather than a stub row list.
- Edge case — resetting the lab clears tester answers and returns the render surface to the preset start state.
- Edge case — closing and reopening the Debug Panel resets phase index, autoplay timers, and tester answers for a fresh run.
- Edge case — the lab remains dev-only and does not expose the repro section outside development mode.

**Verification:**
- In dev mode, the Debug Panel can open a large streaming repro lab and replay preset phases without involving a live provider.

- [ ] **Unit 3: Feed the lab through canonical-scene-derived states and expose inspection evidence**

**Goal:** Make the repro faithful enough to diagnose where the visual streaming failure lives by surfacing canonical, scene, reveal, and viewport evidence side by side.

**Requirements:** R2, R3, R4, R5

**Dependencies:** Units 1-2

**Files:**
- Create: `packages/desktop/src/lib/acp/components/debug-panel/streaming-repro-scene.ts`
- Modify: `packages/desktop/src/lib/acp/components/agent-panel/types/agent-panel-content-props.ts`
- Modify: `packages/desktop/src/lib/acp/components/debug-panel/streaming-repro-lab.svelte`
- Modify: `packages/desktop/src/lib/acp/components/agent-panel/components/agent-panel-content.svelte`
- Modify: `packages/desktop/src/lib/acp/components/agent-panel/components/scene-content-viewport.svelte`
- Test: `packages/desktop/src/lib/acp/components/debug-panel/__tests__/streaming-repro-lab.svelte.vitest.ts`
- Test: `packages/desktop/src/lib/acp/components/agent-panel/components/__tests__/scene-content-viewport.svelte.vitest.ts`

**Approach:**
- Build a narrow scene adapter that converts the controller's active phase into a full synthetic graph materializer input, then derives scene entries through `materializeAgentPanelSceneFromGraph(...)` before the UI sees them.
- Add an explicit dev-only telemetry contract so the inspector can consume follow state, fallback state, reveal activity, and rendered-text evidence without inventing ad hoc local reads. Prefer passive snapshots over new hot-path reactive behavior.
- Surface in-page evidence for: turn state, activity label, latest scene entry id/type, assistant `isStreaming`, reveal activity key/state, viewport follow status, native fallback status/reason, current rendered text length versus phase target length, and inspector data availability status.
- In v1, cover only the required core presets: thinking-only wait, first token, append-only growth, and reveal-drain after semantic completion.
- Make the inspector visibly degrade when telemetry is unavailable or stale, and require the tester to mark such phases `unclear` rather than treating missing telemetry as product evidence.

**Execution note:** Start with a failing integration test for one preset that proves inspector evidence updates when the active phase changes.

**Patterns to follow:**
- `packages/desktop/src/lib/acp/session-state/agent-panel-graph-materializer.ts`
- `packages/desktop/src/lib/acp/components/agent-panel/logic/assistant-text-reveal-projector.svelte.ts`
- `packages/desktop/src/lib/acp/components/agent-panel/components/__tests__/scene-content-viewport.svelte.vitest.ts`

**Test scenarios:**
- Happy path — the first-token preset phase renders an assistant row marked streaming and the inspector shows active reveal/streaming evidence.
- Happy path — append-only assistant growth updates rendered content length across successive phases.
- Edge case — semantic completion with reveal still draining shows completed canonical state without losing visual reveal activity immediately.
- Integration — the inspector reports viewport follow and native-fallback state when the render surface transitions between healthy and fallback conditions.
- Edge case — unavailable telemetry produces an explicit inspector degraded state and the run summary records the phase as unsuitable for a conclusive answer.

**Verification:**
- The lab shows phase-by-phase evidence that lets a human tell whether the bug lives in scene production, reveal pacing, or viewport display.
- The exported run summary is durable enough to compare two QA passes across branches or builds.

## System-Wide Impact

- **Interaction graph:** Debug Panel overlay -> streaming repro lab host -> repro controller -> scene adapter -> `AgentPanelContent` -> `SceneContentViewport` -> existing reveal/follow/fallback behavior.
- **Error propagation:** Dev-only instrumentation must fail closed; missing debug evidence should degrade the inspector, not break the panel render path.
- **State lifecycle risks:** Replay timers, preset changes, and overlay close/open cycles must fully reset controller state to avoid stale reveal or fallback evidence.
- **API surface parity:** Any instrumentation added to panel content or viewport should stay local and optional so production call sites do not gain new required props; the telemetry contract belongs in the existing agent-panel props layer, not an ad hoc debug store.
- **Integration coverage:** At least one mounted path must exercise the real `AgentPanelContent -> SceneContentViewport` chain under preset transitions; pure controller tests alone are insufficient.

## Risks & Dependencies

- The Debug Panel host could still be too layout-constrained to reproduce viewport-sensitive bugs.
  - Mitigation: make the repro surface explicitly panel-sized and keep controller/scene adapter host-agnostic so the same lab can move to a route later.
- A deterministic harness could still miss a live-only timing bug in provider or shell event ordering.
  - Mitigation: treat the first slice as diagnostic infrastructure, not proof of root cause, and promote capture/replay from a known failing live run if v1 presets cannot reproduce the observed symptom.
- Dev-only inspector seams could accidentally perturb production behavior.
  - Mitigation: gate them tightly, keep them read-only, audit what is already derivable before adding new hooks, and prefer passive telemetry snapshots.
- The first preset set could miss the actual failure class.
  - Mitigation: start with the minimum core presets needed for the current streaming question and only broaden to tool/follow/fallback scenarios after the basic QA loop works.

## Documentation / Operational Notes

- No user-facing docs required; this is dev-only diagnostic infrastructure.
- If the lab surfaces a previously hidden render-state mismatch, capture the result as a follow-up learning under `docs/solutions/` after the bug is fixed.

## Sources & References

- Related code: `packages/desktop/src/lib/acp/components/debug-panel.svelte`
- Related code: `packages/desktop/src/lib/acp/components/agent-panel/components/agent-panel-content.svelte`
- Related code: `packages/desktop/src/lib/acp/components/agent-panel/components/scene-content-viewport.svelte`
- Related code: `packages/desktop/src/lib/acp/session-state/agent-panel-graph-materializer.ts`
- Related plan: `docs/plans/2026-04-07-002-feat-reveal-debugger-page-plan.md`
- Related requirements: `docs/brainstorms/2026-05-01-agent-panel-content-reliability-rewrite-requirements.md`
- Related requirements: `docs/brainstorms/2026-04-15-streaming-markdown-during-reveal-requirements.md`
