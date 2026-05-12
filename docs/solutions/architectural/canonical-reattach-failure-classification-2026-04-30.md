---
module: acp-session-architecture
tags:
  - final-god
  - canonical-lifecycle
  - failure-classification
  - resume-boundary
  - error-ui
problem_type: architecture
---

# Canonical Reattach Failure Classification

## Problem

Reopening a previously-saved session that the upstream provider had garbage-collected showed two stacked error surfaces and leaked a raw JSON-RPC string into the UI:

- the big "Unable to load session" page **and** a red inline "Connection error" card carrying `JSON-RPC error -32002 Resource not found: Session …` verbatim,
- a Retry button that could never succeed (the upstream session is gone),
- a parallel TypeScript reattach gate (`localPersistedSessionProbeStatus`, `isPermanentLocalReattachFailure`, `PERMANENT_LOCAL_REATTACH_ERROR_MARKERS`) duplicating the canonical lifecycle authority.

Root cause: `SessionUpdate::ConnectionFailed` carried only an opaque `error: String`, `apply_update` hard-coded `FailureReason::ResumeFailed` for every resume failure, `is_retryable_failure` therefore returned `true`, and the panel UI composed user-facing copy from the raw RPC text. Provider-specific quirks (Copilot returns `-32002`, Cursor returns `-32602`) bled into the UI instead of being absorbed at the resume-boundary adapter.

## Solution

Make canonical lifecycle the only authority for reattach failure classification:

1. **Rust owns the taxonomy.** Add `FailureReason::SessionGoneUpstream` to `acp/lifecycle/state.rs`. Make `SessionUpdate::ConnectionFailed.failure_reason: FailureReason` a required field on the envelope. `apply_update` propagates the envelope's `failure_reason` — no more hard-coded fallback.

2. **One classifier at the resume boundary.** `acp/resume_failure_classifier.rs` maps `SerializableAcpError` → `FailureReason`. It matches the typed `AcpError::SessionNotFound` first, with a defensive `JsonRpcError` substring arm for code paths that bypass the typed conversion. Provider-specific detection is consolidated in `client_errors::is_session_not_found_error`, which now recognizes Cursor's `-32602 Session not found` and Copilot's `-32002 Resource not found Session …` and routes both through `AcpError::SessionNotFound`.

3. **Actionability follows automatically.** `is_retryable_failure` matches only `ActivationFailed | ResumeFailed`, so `SessionGoneUpstream` yields `canRetry == false` and `recommendedAction == Archive` with no carve-out.

4. **TypeScript owns user-facing English.** A single keyed mapper, `failureCopy(agentId, failureReason)`, lives in `packages/desktop/src/lib/acp/components/agent-panel/logic/failure-copy.ts`. The TypeScript canonical reader (`derivePanelErrorInfo`) substitutes curated copy when classified, and falls back to `lifecycle.errorMessage` (raw provider text) for unclassified cases. i18n-ready: replace the function body with a keyed table.

5. **Single error surface.** `showInlineErrorCard` is suppressed when `viewState.kind === "error"` (the big-page variant), so the user sees the curated copy exactly once.

6. **Delete the parallel gate.** `localPersistedSessionProbeStatus`, `setSessionOpenMissing`, `getLocalPersistedSessionProbeStatus`, `setLocalPersistedSessionProbeStatus`, `PERMANENT_LOCAL_REATTACH_ERROR_MARKERS`, `localCreatedReattachUnavailableMessage`, `isPermanentLocalReattachFailure`, and `setLocalReattachFailureIfPermanent` are all removed. `open-persisted-session.ts` reduces to a canonical-driven flow.

7. **Pure $derived, no $effect.** The panel error UI uses `$derived` everywhere:
    - `fallbackInlineErrorReferenceId` is derived via a deterministic FNV-1a hash of `(title, details)` (`deriveLocalReferenceId`) so the same error keeps the same reference id across reactive reads — no `crypto.randomUUID()` inside `$derived`.
    - `errorDismissed` is a derived comparison between a `dismissedErrorKey` (`${failureReason}::${details}`) and the current key. New failure or new details ⇒ new key ⇒ dismissal automatically lifted, no reset effect.

## Layer split

| Layer | Owns | Lives in |
|-------|------|----------|
| Rust | `FailureReason` taxonomy, classifier, `agent_id`, raw provider text in `lifecycle.error_message` | `acp/lifecycle/state.rs`, `acp/resume_failure_classifier.rs`, `client_errors.rs` |
| TypeScript | User-facing English, dismissal UX, reference-id derivation | `agent-panel/logic/failure-copy.ts`, `agent-panel/logic/connection-ui.ts`, `agent-panel.svelte` |

Raw provider text continues to flow through `SessionUpdate::ConnectionFailed.error` → `lifecycle.error_message` for log/debug surfaces; the default UI never displays it.

## Verification

- 2127 Rust lib tests pass; `cargo clippy --lib --tests -- -D warnings` clean.
- 2696 TS tests pass (`AGENT=1 bun test`); `bun run check` clean.
- New tests:
    - `acp/resume_failure_classifier.rs` — 7 unit tests covering Copilot `-32002`, Cursor `-32602`, typed `SessionNotFound`, defensive substring arm, and the non-matching default.
    - `connection-ui.test.ts` — curated-copy substitution for `(copilot, sessionGoneUpstream)`, raw-text fallback for `resumeFailed`.
    - Round-trip test in `apply_update` for both `ResumeFailed` and `SessionGoneUpstream` propagation.
- Net code change: −169 LOC after deleting the TS parallel gate.

## What this prevents

- Future provider-specific reattach quirks have one home (the classifier) instead of leaking into UI gates.
- New canonical failure modes pick up the right `canRetry` automatically — the actionability table stays the source of truth.
- i18n is a single-file change.
- New `$effect`s for error UI are obviously the wrong tool — the deterministic-hash + dismissal-key pattern shows how to derive UI state from canonical data without effects.

## See also

- Plan: `docs/plans/2026-04-30-001-fix-canonical-reattach-failure-classification-plan.md`
- Verification: `docs/solutions/architectural/god-architecture-verification-2026-04-25.md` (R10 update, 2026-04-30)
- `docs/solutions/architectural/canonical-projection-widening-2026-04-28.md` (residual hot-state allowlist no longer includes `localPersistedSessionProbeStatus`)
