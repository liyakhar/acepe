---
title: Canonical session projection is the source for UI-visible session state
date: 2026-05-01
category: best-practices
module: desktop ACP session summaries
problem_type: best_practice
component: assistant
severity: high
applies_when:
  - Adding or updating UI surfaces that display session lifecycle, activity, turn state, or current model
  - Building SessionSummary values for sidebars, settings panels, archived sessions, or other list rows
  - Rendering provider-specific lifecycle failure copy before a full session graph snapshot may exist
tags:
  - session-state
  - canonical-authority
  - session-summary
  - ui-derivation
  - hot-state
  - failure-copy
---

# Canonical session projection is the source for UI-visible session state

## Context

Acepe's `SessionStateGraph` projection owns lifecycle, activity, turn state, active-turn failure, capabilities, and current-model truth. `SessionTransientProjection` exists for local affordances such as pending send intent, telemetry snapshots, and mutation progress. It must not become a second authority for product-visible session state.

Plan 005 closed a residual gap where session-list surfaces still read `SessionTransientProjection` for sidebar/settings/archive summaries, and the agent panel still read hot state for the PR popover's model default. The fix introduced a single summary derivation path in `packages/desktop/src/lib/acp/application/dto/session-summary.ts` and migrated the call sites to canonical accessors.

## Guidance

Do not read canonical-owned fields from hot state:

```ts
// Wrong: hot state is not lifecycle, connection, or streaming authority.
const hot = sessionStore.getHotState(cold.id);

return {
	id: cold.id,
	title: cold.title,
	status: hot.status,
	isConnected: hot.isConnected,
	isStreaming: hot.turnState === "streaming",
};
```

Instead, derive list-display state from the canonical projection and centralize the cold-record mapping:

```ts
const listState = deriveSessionListStateFromCanonical(
	sessionStore.getCanonicalSessionProjection(cold.id)
);

return buildSessionSummaryFromCold({
	cold,
	listState,
	entryCount,
	lastEntry,
});
```

Use dedicated canonical accessors for capability fields instead of reaching into hot state or raw graph snapshots:

```ts
const sessionCurrentModelId = sessionId
	? sessionStore.getSessionCurrentModelId(sessionId)
	: null;
```

Keep lifecycle/activity/turn precedence in one helper. `activity.kind === "error"` and `activity.kind === "paused"` must win over a stale `turnState === "Running"` value, because an errored or paused session should not continue to display as streaming.

Provider-specific failure copy has one extra edge case: a lifecycle failure can exist before `sessionStateGraph` has a full snapshot. For copy routing, use the cold session identity (`sessionIdentity?.agentId` / `cold.agentId`), not `sessionStateGraph?.agentId`.

```ts
const sessionAgentId = sessionIdentity?.agentId ?? null;

const errorInfo = derivePanelErrorInfo({
	agentId: sessionAgentId,
	panelConnectionState,
	panelConnectionError,
	sessionConnectionError,
	sessionTurnState: activeTurnState,
	activeTurnError,
	sessionFailureReason,
});
```

## Why This Matters

Hot-state reads make UI state drift possible. A sidebar, archived-session row, or settings list can silently disagree with the canonical graph if it recomposes lifecycle, connection, streaming, or model state locally.

Centralizing summary derivation gives every list-like surface the same answers for:

- null canonical projection: idle, disconnected, not streaming,
- activating or reconnecting lifecycle: connecting,
- failed lifecycle or error activity: error,
- paused activity: paused and connected,
- running/awaiting/waiting activity or running turn: streaming,
- otherwise ready and connected.

It also preserves the DTO boundary: `SessionCold` provides immutable identity and metadata, `CanonicalSessionProjection` provides current session state, and `SessionSummary` is the presentation-safe result.

## When to Apply

- Any UI surface renders session lifecycle, connection, streaming, pause, or error state.
- A component needs the current model for display or as a default.
- A session list, project tab, archive view, queue row, or settings panel constructs `SessionSummary`.
- Error copy needs provider identity while graph snapshot availability is uncertain.

## Examples

Sidebar/session-list surfaces should all follow the same pattern:

```ts
const visibleSessions = $derived.by(() => {
	return coldSessions.map((cold) => {
		const listState = deriveSessionListStateFromCanonical(
			sessionStore.getCanonicalSessionProjection(cold.id)
		);

		return buildSessionSummaryFromCold({
			cold,
			listState,
			entryCount: 0,
		});
	});
});
```

Settings and archived-session surfaces can still compute their own `entryCount` or optional `lastEntry`, but they should not duplicate the lifecycle/activity mapping:

```ts
const entryCount = sessionStore.getEntries(cold.id).length;
const listState = deriveSessionListStateFromCanonical(
	sessionStore.getCanonicalSessionProjection(cold.id)
);

return buildSessionSummaryFromCold({
	cold,
	listState,
	entryCount,
});
```

Current-model defaults should use the store accessor:

```ts
const modelId = sessionStore.getSessionCurrentModelId(sessionId);
```

## Related

- `docs/solutions/architectural/canonical-projection-widening-2026-04-28.md`
- `docs/solutions/architectural/final-god-architecture-2026-04-25.md`
- `docs/solutions/architectural/graph-backed-session-activity-authority-2026-04-23.md`
- `packages/desktop/src/lib/acp/application/dto/session-summary.ts`
- `packages/desktop/src/lib/acp/store/canonical-session-projection.ts`
