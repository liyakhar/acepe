# Streaming QA Incident Report

Date: 2026-05-05

## Summary

The app has more than one streaming bug right now.

The most important fact is this: the raw streaming logs contain the full assistant answers, but the app was observed showing only `Ra` for one session. That means the provider did send the rest of the text. The failure is inside Acepe's state/render path after the raw event arrives.

I found 5 likely bugs:

1. Same-key assistant reveal can shrink visible text to a tiny prefix like `Ra`.
2. Frontend ignores raw assistant chunks and depends fully on canonical session-state envelopes.
3. The DB journal does not persist assistant text chunks for these created sessions.
4. Session title updates are not reflected in the DB/session metadata.
5. Failed or partial QA session creation can leave orphan sessions with no useful state.

## Evidence Checked

Streaming logs:

- `/Users/alex/Library/Application Support/Acepe/logs/streaming/17afb2e8-f645-4b3c-82f4-ff2e37ee7dfa.jsonl`
- `/Users/alex/Library/Application Support/Acepe/logs/streaming/86780b10-df6f-45cb-92e3-413ae4efb691.jsonl`
- Also checked recent related log: `/Users/alex/Library/Application Support/Acepe/logs/streaming/6b0fa218-6f7c-4845-810a-8f0c34fa6bf0.jsonl`

Database:

- `/Users/alex/Library/Application Support/Acepe/acepe_dev.db`
- Also checked schema of `/Users/alex/Library/Application Support/Acepe/acepe.db`

Existing visual evidence:

- `/Users/alex/Documents/acepe/.codex-tauri-current-bad-render.png`

## Session Findings

### Session `86780b10-df6f-45cb-92e3-413ae4efb691`

Agent: `copilot`

Raw stream:

- 23 log lines.
- 19 `agent_message_chunk` events.
- Full assistant text length: 941 characters.
- First chunk was exactly `Ra`.
- Later chunks complete the answer:

```text
Raincoats are a humble triumph of practical design...
```

DB state:

- Session exists in `session_metadata`.
- Session exists in `acepe_session_state`.
- Journal has only 3 events:
  - 2 `materialization_barrier`
  - 1 `projection_update` with `turn_complete`
- Journal has 0 assistant chunk events.

Important conclusion:

If the UI stayed at `Ra`, the raw provider stream was not the problem. The later chunks existed. Acepe either did not convert later chunks into usable session-state deltas, dropped those deltas, or rendered stale reveal state.

### Session `17afb2e8-f645-4b3c-82f4-ff2e37ee7dfa`

Agent: `cursor`

Raw stream:

- 108 log lines.
- 103 `agent_message_chunk` events.
- Full assistant text length: 475 characters.
- Full answer is exactly four short paragraphs about raincoats.
- Raw log includes a `session_info_update` title: `Raincoat Revealer`.

DB state:

- Session exists in `session_metadata`.
- Session exists in `acepe_session_state`.
- DB display is still `Session 17afb2e8`.
- `title_override` is null.
- Journal has only 3 events:
  - 2 `materialization_barrier`
  - 1 `projection_update` with `turn_complete`
- Journal has 0 assistant chunk events.

Important conclusion:

The raw provider stream looks healthy. The DB did not persist the assistant text or the title update.

### Session `6b0fa218-6f7c-4845-810a-8f0c34fa6bf0`

Agent: `claude-code`

Raw stream:

- 69 log lines.
- Has thought chunks, message chunks, a final assistant message, result, and turn complete.
- This is a different provider shape from Cursor and Copilot.

DB state:

- Recent DB summary shows 2 journal events and 1 turn complete.
- 0 chunk events in journal.

Important conclusion:

The persistence gap is not limited to one provider.

## Bug List

### Bug 1: Reveal can shrink to a tiny prefix

Status: fixed in working tree, but the running app may not include it yet.

Evidence:

- The bad UI showed `Ra`.
- The old coordinator logic allowed same-key replacements to shrink visible text to a common prefix.
- I added a test for the `Ra` class of failure and changed the coordinator so streaming same-key rewrites do not move visible text backwards.

Touched files:

- `packages/desktop/src/lib/acp/components/agent-panel/logic/assistant-reveal-coordinator.svelte.ts`
- `packages/desktop/src/lib/acp/components/agent-panel/logic/__tests__/assistant-reveal-coordinator.test.ts`

Confidence: high.

### Bug 2: Raw chunks have no frontend fallback

Status: open.

Evidence:

- `session-event-service.svelte.ts` records raw assistant chunks, then returns early for `agentMessageChunk` and `agentThoughtChunk`.
- That means the visible transcript depends on session-state envelopes.
- The raw logs prove later chunks arrived, but the UI was observed stuck at the first chunk.

Why this matters:

If the canonical envelope path misses, delays, or rejects a transcript delta, the UI has no backup path. It can show stale or partial text even while the raw stream is healthy.

Confidence: high that this is a design risk; medium that it is the direct cause of the current stuck UI.

### Bug 3: Assistant text is not durable in DB journal

Status: open.

Evidence:

- For both user-provided sessions, DB journal has only barriers and `turn_complete`.
- There are 0 assistant chunk events in the journal.
- `ProjectionJournalUpdate::from_session_update` journals permissions, questions, turn complete, and turn error, but not assistant/user chunks.

Why this matters:

If runtime memory is lost, or provider history is not available, Acepe cannot rebuild the assistant transcript from its own DB for these created sessions. The raw streaming log has the truth, but it is debug data, not product state.

Confidence: high for the DB fact; medium on whether this is intended architecture or an unfinished migration endpoint.

### Bug 4: Session title update is not persisted

Status: open.

Evidence:

- `17afb2e8...` raw stream contains `session_info_update` with title `Raincoat Revealer`.
- DB `session_metadata.display` is still `Session 17afb2e8`.
- DB `acepe_session_state.title_override` is null.

Why this matters:

The session list can stay generic even after the provider gives a better title. This makes QA confusing because the sidebar does not reflect the actual session.

Confidence: medium-high.

### Bug 5: Orphan/empty created sessions

Status: open.

Evidence:

Recent DB sessions after 13:00 UTC include:

- `019df857-12b2-7451-965d-7f1dc73b32eb`, agent `codex`, 0 journal events.
- This matches the earlier failed QA attempt where a created test session did not successfully send.

Why this matters:

Failed session creation can leave visible or persisted session shells. That makes the app feel broken because users can land on sessions with no useful transcript or lifecycle.

Confidence: medium.

## What Is Not The Main Cause

The provider did not only send `Ra`.

For `86780b10...`, the raw file starts with `Ra`, but then sends the rest of the answer over the next 18 chunks. So a UI stuck at `Ra` is not explained by provider output alone.

## Recommended Fix Order

1. Keep the reveal coordinator fix. It prevents the visible row from shrinking backward during same-key rewrites.
2. Add instrumentation around session-state envelopes:
   - Log every transcript delta for these sessions.
   - Log `fromRevision`, `toRevision`, and whether the frontend applies or refreshes.
   - Log refresh failures from `refreshSessionStateSnapshot`.
3. Add a failing test where raw chunks arrive, canonical delta path is delayed or mismatched, and the UI must not get stuck on the first chunk.
4. Decide the durable source of truth:
   - Either persist transcript-bearing updates in the journal, or
   - Persist periodic transcript snapshots, or
   - Explicitly document that provider-owned history is required and add UI warnings when local state is incomplete.
5. Persist provider title updates into session metadata/state.
6. Clean up failed session creation so empty created shells do not remain after a send fails before the first transcript event.

## Current Risk

The app can currently appear to complete a turn while showing incomplete text. This is worse than a simple blank-row bug because the raw stream can be correct while the visible conversation is wrong.

The safest next move is not more visual tweaking. The next move is to test and instrument the session-state envelope path, because that is the layer between healthy raw chunks and broken visible transcript.

## Live MCP QA Update

Time: 2026-05-05 18:09-18:18 Asia/Jerusalem

Tooling:

- Hypothesi/Tauri MCP server: `@hypothesi/tauri-mcp-server@0.11.1`
- Connected app: `com.acepe.app`
- App version: `2026.3.33`
- Tauri version: `2.10.3`
- MCP bridge port: `9223`

Screenshots:

- `/Users/alex/Documents/acepe/.codex-tauri-live-qa-now.png`
- `/Users/alex/Documents/acepe/.codex-tauri-live-stream-12.png`
- `/Users/alex/Documents/acepe/.codex-tauri-copilot-live5-2.png`

### Live visual state

The app is still not clean.

The right Copilot raincoat session rendered the original four-paragraph answer correctly after reload. That is good evidence that the fixed reveal path can display a completed Copilot transcript correctly.

The middle Cursor raincoat session was still bad. It showed duplicated assistant text:

- first answer content
- then another copy of the same topic appended directly after `keep going.`
- one missing paragraph break between `keep going.` and `Raincoats are quiet heroes...`

This means we should not call the migration fully QA-passed yet. The original `Ra` symptom is not visible in that panel anymore, but replacement/duplication state is still wrong for at least one existing session.

### Fresh Codex session QA

I tried to send a new test message from the left Codex panel:

```text
STREAMQA-LIVE4 write two very short paragraphs about umbrellas, reveal slowly.
```

The app failed before streaming started.

Visible error:

```text
Unable to load session
Failed to create session for agent codex in project /Users/alex/Documents/charizard
Failed to promote creation attempt c171bc32-5d47-49b0-a719-daa869d0f816 into session 019df8b1-69b7-7c11-8d39-9e675689fb2e:
UNIQUE constraint failed: session_metadata.file_path
```

DB evidence:

- `creation_attempts.id = c171bc32-5d47-49b0-a719-daa869d0f816`
- `creation_attempts.status = failed`
- `creation_attempts.failure_reason = metadata-promotion-failed ... UNIQUE constraint failed: session_metadata.file_path`
- `session_metadata.id = 019df8b1-69b7-7c11-8d39-9e675689fb2e`
- `session_metadata.file_path = __session_registry__/019df8b1-69b7-7c11-8d39-9e675689fb2e`
- `acepe_session_state.relationship = opened`

Important conclusion:

This is not a markdown bug. It is a session creation/promotion bug. The app can create a placeholder session row, then fail promoting the creation attempt because the registry file path already exists.

### Existing Copilot follow-up QA

I then sent a follow-up in the already-open Copilot session:

```text
STREAMQA-LIVE5 answer with two tiny bullet points about umbrellas.
```

Raw stream and DB journal were healthy:

- Raw log file updated: `/Users/alex/Library/Application Support/Acepe/logs/streaming/86780b10-df6f-45cb-92e3-413ae4efb691.jsonl`
- New journal events were persisted:
  - event 19: `user_message_chunk`
  - events 20-23: `agent_message_chunk`
  - event 24: `turn_complete`
- Assistant chunks reconstructed to:

```text
- Portable canopies that pop open to block rain or sun.
- Best friend on drizzly days; worst enemy in strong wind.
```

This is good backend evidence. It shows the new transcript journaling path is working for this live Copilot follow-up.

But after the follow-up, Hypothesi MCP webview calls became unreliable:

- `webview_dom_snapshot` stopped finding the marker after the first two polling ticks.
- `webview_find_element` timed out.
- `webview_execute_js` timed out.
- `webview_screenshot` timed out and the fallback screenshot path also timed out.
- `read_logs source=console` timed out because the webview did not answer.

The Rust process itself was not busy:

- process state: sleeping
- CPU: `0.0%`
- memory: `0.3%`

Important conclusion:

The backend did receive and persist the follow-up correctly. The webview became hard to inspect through MCP after that. This may be a MCP bridge/WebView timeout issue, a frontend main-thread stall, or a very heavy DOM snapshot path. It needs a smaller focused repro before we blame the reveal coordinator.

## Updated Bug Count

Current known bugs or open risks from QA:

1. Existing Cursor session can render duplicated/concatenated assistant text.
2. Codex session creation/promotion can fail with `UNIQUE constraint failed: session_metadata.file_path`.
3. A failed Codex creation leaves a visible broken panel plus an opened placeholder DB row.
4. MCP/webview inspection can time out after a live follow-up, while the Rust process is idle.
5. The original same-key `Ra` reveal bug is fixed in tests, but needs another clean live pass after the creation/promotion blocker is fixed.

Current positive evidence:

1. Completed Copilot transcript can render correctly after reload.
2. Live Copilot follow-up now persists `user_message_chunk`, `agent_message_chunk`, and `turn_complete` into `session_journal_event`.
3. Full automated test suite passed after the implementation.

## Codex Fix Follow-up

After the Codex blocker was isolated, two fixes were added.

First fix: creation attempt promotion now reuses an existing opened placeholder row when the provider returns the same session id. Before the fix, the regression test failed with:

```text
UNIQUE constraint failed: session_metadata.file_path
```

After the fix, the focused Rust test passed:

```text
cargo test creation_attempt_promotion_reuses_existing_opened_placeholder_session
```

Live DB evidence for the new Codex session:

- `creation_attempts.id = 987dbe57-2f7a-4ce3-9c9c-8afd38e4561d`
- `creation_attempts.status = consumed`
- `creation_attempts.provider_session_id = 019df8c6-6615-7c73-abc3-b7d64fce3191`
- `session_metadata.file_path = __session_registry__/019df8c6-6615-7c73-abc3-b7d64fce3191`
- `acepe_session_state.relationship = created`

Second fix: the graph materializer no longer lets a stale live assistant entry hide a completed canonical answer. This was the reason the live Codex row showed only `Umb` while the backend snapshot already had all segments for:

```text
Umbrellas keep you dry when it rains.
```

The failing frontend test reproduced the problem exactly: completed graph text was full, but the visible scene used stale live text `Umb`. After the fix, this test passed:

```text
bun test ./src/lib/acp/session-state/__tests__/agent-panel-graph-materializer.test.ts
```

Live visual evidence:

- Before frontend fix/reload: DOM showed only `Umb`.
- After frontend fix and webview reload: DOM showed `Umbrellas keep you dry when it rains.`
- Screenshot: `/Users/alex/Documents/acepe/.codex-tauri-codex-display-after-refresh.png`

Second live Codex send:

```text
STREAMQA-CODEX-FIX2 reply with exactly: Apples stay crisp.
```

Backend evidence was healthy:

- raw stream emitted `Ap`, `ples`, ` stay`, ` crisp`, `.`
- journal events 16-22 were persisted
- turn completed cleanly

Remaining QA limitation: after that second live send, Hypothesi MCP webview calls started timing out again for DOM and screenshot operations. So the backend path is verified, and the first visual Codex render after reload is verified, but the second visual pass could not be inspected because the MCP bridge stopped answering webview calls.

## Stuck Awaiting-Model Follow-up

The user screenshot at `2026-05-05 18:52:52` showed the same Codex session visually stuck after the second prompt:

```text
STREAMQA-CODEX-FIX2 reply with exactly: Apples stay crisp.
```

Visible state:

- first answer rendered correctly: `Umbrellas keep you dry when it rains.`
- second user prompt rendered
- second assistant answer did not render
- the row still showed `Planning next moves...`

Backend evidence still showed the turn was complete:

- journal events 17-21 contained assistant chunks for `Apples stay crisp.`
- journal event 22 was `turn_complete`
- the raw streaming log emitted outgoing `turnComplete`

Frontend reducer QA:

- Added a focused test that applies the same first-turn complete state, second user delta, second assistant chunks, and terminal turn delta.
- Result: the reducer/materializer renders both assistant answers and clears streaming state.

This means the visible stuck state was not caused by the graph reducer being unable to render the canonical data. The higher-risk gap is live event delivery: the app uses an SSE bridge backed by a broadcast channel. If the webview misses a burst or disconnects during a turn, there is no replay for normal live events, so the frontend can remain stuck at the last event it saw.

Defensive fix added:

- While a session is in `awaiting_model` or `Running`, the session store now schedules a canonical snapshot refresh after 5 seconds without a newer state update.
- Any newer running/chunk event resets the timer.
- Any completed/idle state clears the timer.
- This turns a missed completion event into a recoverable stale-state refresh instead of a permanent spinner.

Verification added:

```text
bun test ./src/lib/acp/store/__tests__/session-store-projection-state.vitest.ts -t "stale awaiting-model|renders a completed second turn"
bun run check
```

Both passed.

## WebView Freeze Follow-up

On `2026-05-06`, live QA found that the app was not only stuck in a stale planning state. The Tauri bridge could connect, but even a tiny webview script timed out:

```text
document.title -> Request timeout
```

Process evidence showed the native Tauri process was idle, while the Acepe WebKit WebContent process was pegged:

```text
com.apple.WebKit.WebContent: ~100% CPU, 1.2GB-3.5GB footprint
```

A process sample pointed at a frontend render loop involving `ResizeObserver` creation/destruction during streaming/reveal updates. The concrete code issue was in `MessageWrapper`: the Svelte action received a fresh object on each render, so its `update` handler always called `stop()` then `start()`. During reveal ticks this repeatedly recreated `ResizeObserver` instances and registered/unregistered reveal targets.

Fix added:

- `MessageWrapper` now keeps the current action params and only restarts when the controller, entry key, resize mode, or callback availability changes.
- The registered reveal handler reads the latest params, so normal `entryIndex` or callback identity updates do not require a new observer.
- Added a pure regression test for the restart rule.

The blink symptom had a separate coordinator bug:

- While awaiting the next model response, the coordinator could briefly bind the previous completed assistant as the active reveal target.
- That emitted `visibleText: ""` for the previous row, making the last assistant message disappear for a frame.
- The coordinator now waits for the next assistant instead of re-revealing a completed, non-streaming previous assistant.

Verification:

```text
bun test ./src/lib/acp/components/messages/logic/__tests__/reveal-target-action-params.test.ts
bun test ./src/lib/acp/components/agent-panel/logic/__tests__/assistant-reveal-coordinator.test.ts
bun test ./src/lib/acp/store/__tests__/session-store-projection-state.vitest.ts -t "stale awaiting-model|renders a completed second turn"
bun run check
```

All passed.

## Restarted App Freeze Follow-up

The user restarted the app and the freeze reproduced again during live QA.

Live QA prompt:

```text
STREAMQA-CODEX-LIVE10 reply exactly: Maple cups shine.
```

Backend result:

- session id: `019df8c6-6615-7c73-abc3-b7d64fce3191`
- turn id: `019dfaa6-9ea4-7250-966b-e82557b1bac4`
- journal event `195` was `turn_complete`
- streaming log emitted the complete answer: `Maple cups shine.`
- streaming log emitted `thread/status/changed idle` and outgoing `turnComplete`

Frontend result:

- WebContent stayed pinned around 100% CPU after the backend completed.
- MCP JavaScript execution timed out after the freeze.
- The newer WebKit sample moved away from raw EventSource processing and into a DOM timer / microtask path.

New root cause candidate promoted to confirmed code smell:

- The local terminal-turn observation was only applied to some UI state.
- `AgentPanel` still passed the stale `Running + awaiting_model` graph into scene materialization.
- That meant one layer could say "done" while the scene rows and content viewport still behaved like the assistant row was streaming.
- This is split authority: status, reveal, scene materialization, and content streaming were not using the same effective turn state.

Fix added:

- `deriveEffectiveCanonicalTurnPresentation` now centralizes the local-terminal override.
- `AgentPanel` uses that same effective state for:
  - panel status
  - `sessionTurnState`
  - scene graph materialization
  - assistant reveal facts
  - awaiting-model checks
- When local terminal observation sees stale `Running + awaiting_model`, the presentation graph becomes `Completed + idle`, so stale streaming rows are not reintroduced.

Verification:

```text
bun test ./src/lib/acp/components/agent-panel/logic/__tests__/session-status-mapper.test.ts
bun test ./src/lib/acp/session-state/__tests__/agent-panel-graph-materializer.test.ts
bun test ./src/lib/acp/components/agent-panel/logic/__tests__/assistant-reveal-coordinator.test.ts
bun run check
```

All passed.

Remaining QA limitation:

- The current WebContent process is already frozen and cannot reliably consume hot reload.
- One more app restart is required before live MCP QA can prove whether this removes the freeze in the real app.

## Freeze Reproduced After Restart

The user restarted, sent another message, and the app froze again.

Backend result:

- session id: `019df8c6-6615-7c73-abc3-b7d64fce3191`
- latest journal event observed: `296`
- event `296` was `turn_complete`
- streaming log showed `thread/status/changed idle`, `turn/completed`, and outgoing `turnComplete`
- assistant text completed normally

Frontend result:

- new WebContent pid: `85350`
- CPU: about 106%
- physical footprint: about 2.1GB
- sample path: `/tmp/acepe-webcontent-85350-freeze.sample.txt`
- sample still showed `DOMTimer -> ScheduledAction -> MicrotaskQueue`, many JavaScript property getter / Set operations, and heavy GC/string allocation pressure

Conclusion:

- The stale-running graph fix was necessary but not sufficient.
- The remaining freeze is still tied to frontend timer-driven reveal/render work.
- Since the app is production-unusable while frozen, animation should be removed from the coordinator until a safer design exists.

Emergency stabilization added:

- `AssistantRevealCoordinator` no longer owns any `setTimeout` or self-scheduling reveal tick.
- Smooth mode now renders the latest assistant target text immediately, same as instant mode for the actual text.
- It still preserves the key safety guarantees:
  - same-key replacement does not blank visible text
  - same-key append remains prefix-compatible
  - pending next-user state does not reveal the stale previous assistant
  - terminal/completed state stops reveal activity

Verification:

```text
bun test ./src/lib/acp/components/agent-panel/logic/__tests__/assistant-reveal-coordinator.test.ts
bun test ./src/lib/acp/components/agent-panel/logic/__tests__/session-status-mapper.test.ts ./src/lib/acp/session-state/__tests__/agent-panel-graph-materializer.test.ts ./src/lib/acp/logic/__tests__/acp-event-bridge.test.ts
bun run check
```

All passed.

Remaining QA limitation:

- The current WebContent process is frozen, so this needs one more app restart before live MCP QA can verify the no-timer coordinator in the app.

## LIVE9 Freeze After Previous Fixes

The user reproduced the freeze again after the pending-send cleanup.

Observed state:

- screenshot: `/tmp/acepe-frozen-again.png`
- visible UI: Codex panel showed `STREAMQA-CODEX-LIVE9 reply exactly: Cedar lamps glow.` plus `Planning next moves...`
- backend streaming log completed normally with `Cedar lamps glow.`
- SQLite journal completed normally with `turn_complete` at event `186`
- Tauri process stayed idle
- WebKit WebContent stayed hot: roughly 100-170% CPU
- Hypothesi/Tauri MCP console read timed out because WebView JavaScript could not run

Important conclusion:

This was not only stale backend state. The renderer was busy. Two process samples showed the main thread inside `EventSource` message handling and JavaScript microtasks. That means frontend SSE event handling was doing too much work synchronously inside the native browser event callback.

Fix added:

- `openAcpEventSource` now pushes parsed envelopes through `createAcpEventDrain`.
- The drain processes small batches on macrotasks instead of running all store updates directly inside `EventSource.onmessage`.
- This gives WebKit a chance to paint, handle input, and answer MCP JS between event batches.

Extra hardening added:

- `SessionTransientProjectionStore.updateHotState` now ignores no-op updates, including empty updates.
- `AgentPanel` now passes terminal-observed reveal facts to the assistant reveal coordinator, so a raw terminal signal can stop stale `Running/awaiting_model` reveal state from staying active forever.

Verification:

```text
bun test ./src/lib/acp/logic/__tests__/acp-event-bridge.test.ts ./src/lib/acp/store/__tests__/session-transient-projection-store-noop.test.ts ./src/lib/acp/components/agent-panel/logic/__tests__/session-status-mapper.test.ts
bun test ./src/lib/acp/store/__tests__/session-event-service-streaming.vitest.ts ./src/lib/acp/store/services/__tests__/session-messaging-service-stream-lifecycle.test.ts
bun run check
```

Passed.

Known test gap:

- `scene-content-viewport.svelte.vitest.ts` still hangs in the component test harness and was stopped manually.
- `assistant-reveal-coordinator.test.ts` currently has one failing timing expectation around `fadeStartOffset` after a second reveal tick. The behavior still stays prefix-compatible and visible; the expectation appears too strict for the current paced reveal timing.

Next QA step:

- Restart/reload the user-managed dev app so the new frontend code is active.
- Send a tiny Codex prompt again.
- Expected result: no renderer CPU spike, MCP JS responds, no persistent `Planning next moves...`, and the assistant text does not blink blank.

Live QA status:

- The currently open app's WebContent process was already wedged, so it could not hot-reload the fix.
- Killing the stuck WebContent process did not recover the existing window enough for MCP QA; window and JS calls still timed out.
- A full app restart is required before the next live send QA is meaningful.

## Post-Restart Freeze QA

After a full app restart on `2026-05-06`, the window loaded and MCP JavaScript calls worked again before sending a new message.

Test prompt:

```text
STREAMQA-CODEX-LIVE8 reply exactly: Pine clocks tick.
```

Backend result:

- session id: `019df8c6-6615-7c73-abc3-b7d64fce3191`
- journal events 42-48 were written
- assistant chunks reconstructed to `Pine clocks tick.`
- raw stream emitted `turnComplete`
- session state moved back to idle

Frontend result:

- first two MCP polls saw `Planning next moves...`
- after that, `webview_execute_js` timed out
- WebKit WebContent was pinned above 100% CPU with a large memory footprint
- native Tauri stayed idle

Important conclusion:

The restart proved the backend is healthy for this tiny turn, but the frontend still freezes after live streaming. The earlier ResizeObserver restart fix reduced one loop, but it did not finish the problem.

Second frontend fix added:

- `SceneContentViewport` no longer keeps its own mutable reveal-activity sets.
- The viewport now derives native fallback from coordinator-owned row state only: `isStreaming` or `revealRenderState.isActive`.
- This removes the old viewport-side reveal authority path and matches the migration endpoint.

Third frontend fix added:

- `MessageWrapper` resize handling is now RAF-coalesced.
- A burst of `ResizeObserver` callbacks can ask for at most one reveal per animation frame.
- Pending resize reveal is cancelled when the action restarts or unmounts.

Verification:

```text
bun test ./src/lib/acp/components/messages/logic/__tests__/reveal-resize-scheduler.test.ts
bun test ./src/lib/acp/components/messages/logic/__tests__/reveal-target-action-params.test.ts
bun test ./src/lib/acp/components/agent-panel/logic/__tests__/assistant-reveal-coordinator.test.ts
bun test ./src/lib/acp/store/__tests__/session-store-projection-state.vitest.ts -t "stale awaiting-model|renders a completed second turn"
bun run check
```

All passed.

Remaining QA limitation:

- The broad `scene-content-viewport.svelte.vitest.ts` and streaming-regression component tests currently hang under the Bun/Svelte component harness. They were stopped manually after 30 seconds.
- That means live QA after another app restart is still required before calling the frontend freeze fixed.

## Persistent Planning Indicator Follow-up

The user reported the app was still hanging after the frontend loop fixes.

Backend evidence for the latest Codex turn was healthy:

- session id: `019df8c6-6615-7c73-abc3-b7d64fce3191`
- latest journal event was `84`
- event `84` was `turn_complete`
- raw streaming log contained the full assistant answer and `thread/status/changed idle`

New root cause found:

- `AgentPanel` passes `isWaitingForResponse={showPlanningIndicator || hasImmediatePendingSendIntent}`.
- `hasImmediatePendingSendIntent` stays true while `sessionHotState.pendingSendIntent` exists.
- `pendingSendIntent` was cleared only when the canonical user transcript row preserved the local `attemptId`.
- Some live canonical transcripts complete without that local attempt id.
- Result: the backend can be complete while the UI still appends the `Planning next moves...` thinking row until the 90-second pending-send timeout.

Fix added:

- On canonical stream/turn completion, `SessionMessagingService.handleStreamComplete` now clears the local pending send intent for that session.
- This is safe because there is only one active send per session, and terminal completion means the local optimistic send marker is no longer needed.

Regression test added:

```text
clears pending send intent when the canonical turn completes without a user attempt id
```

Verification:

```text
bun test ./src/lib/acp/store/__tests__/session-store-projection-state.vitest.ts -t "clears pending send intent when the canonical turn completes|clears pending send intent only when canonical user attemptId matches|stale awaiting-model|renders a completed second turn"
bun test ./src/lib/acp/store/services/__tests__/session-messaging-service-send-message.test.ts
bun test ./src/lib/acp/components/messages/logic/__tests__/reveal-resize-scheduler.test.ts ./src/lib/acp/components/messages/logic/__tests__/reveal-target-action-params.test.ts ./src/lib/acp/components/agent-panel/logic/__tests__/assistant-reveal-coordinator.test.ts ./src/lib/acp/store/services/__tests__/session-messaging-service-send-message.test.ts
bun run check
```

All passed.
