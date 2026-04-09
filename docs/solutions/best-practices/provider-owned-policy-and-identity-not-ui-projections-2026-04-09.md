---
title: Keep provider-owned policy and identity out of UI projections
date: 2026-04-09
category: best-practices
module: desktop ACP runtime
problem_type: best_practice
component: assistant
severity: high
applies_when:
  - reconnect or autonomous behavior needs provider lifecycle policy
  - resume can redirect through an effective override agent
  - grouped model resolution depends on backend-projected display groups
  - provider-owned history loading must distinguish local and provider session identities
symptoms:
  - reconnect behavior depends on modelsDisplay presentation metadata
  - resumed capabilities cache under the wrong agent after agentOverrideId reconnects
  - grouped model resolution breaks when labels differ from provider/base ids
  - live selectors reparse raw provider ids instead of using backend display groups
  - replay paths use local session ids where provider history ids are required
root_cause: logic_error
resolution_type: code_fix
related_components:
  - session-connection-manager
  - agent-model-preferences-store
  - model-selector
  - session-loading
  - provider-capabilities
tags:
  - provider-metadata
  - agent-agnostic
  - session-resume
  - model-selector
  - history-session-id
  - replay-identity
---

# Keep provider-owned policy and identity out of UI projections

## Context

Acepe’s agent-agnostic overhaul had already pushed most provider-specific logic to adapter edges, but the `/ce:review` pass exposed a last cluster of leaks. Shared runtime code was still reconstructing provider meaning from UI-facing projection data and presentation labels during reconnect, resume override handling, grouped-model resolution, selector rendering, and provider-owned replay loading.

That meant the architecture looked provider-neutral in the happy path while still depending on display metadata and local heuristics under the hood.

## Guidance

Keep provider policy and provider identity in explicit provider-owned contracts. Shared frontend/runtime code should consume those contracts directly instead of inferring behavior from `modelsDisplay`, labels, or local session identifiers.

In this fix, the contract boundary became explicit in three places:

1. **Provider lifecycle policy travels as typed metadata, not display projection.**

```ts
private resolveProviderMetadata(
	agentId: string,
	providerMetadata: ProviderMetadataProjection | null | undefined
): ProviderMetadataProjection {
	return resolveProviderMetadataProjection(
		agentId,
		providerMetadata ?? preferencesStore.getCachedProviderMetadata(agentId),
		agentId
	);
}
```

`SessionConnectionManager` now resolves reconnect/autonomous behavior from explicit `providerMetadata`, with a dedicated provider-metadata cache behind it, instead of reading `modelsDisplay.presentation.provider`.

2. **Grouped-model identity comes from model ids, not labels.**

```ts
private matchesDisplayGroupIdentity(
	group: ModelsForDisplay["groups"][number],
	currentModelId: string
): boolean {
	const baseModelId = this.resolveDisplayGroupBaseModelId(group);
	if (!baseModelId) {
		return false;
	}

	if (baseModelId === currentModelId) {
		return true;
	}

	const trailingBaseToken = baseModelId.includes("/")
		? baseModelId.slice(baseModelId.lastIndexOf("/") + 1)
		: baseModelId;
	return trailingBaseToken === currentModelId;
}
```

This keeps model resolution tied to provider/base ids even when human-facing labels change.

3. **Provider-owned replay uses provider history identity.**

```rust
let lookup_session_id = provider_owned_history_lookup_id(context);

fn provider_owned_history_lookup_id(
    context: &crate::history::session_context::SessionContext,
) -> &str {
    &context.history_session_id
}
```

Provider replay paths now load history with `history_session_id`, reserving the Acepe-local id for local storage/UI identity.

The live split selector follows the same rule: use backend-projected groups first and fall back to client parsing only when the backend did not project a grouped model family.

```ts
const reasoningBaseGroupsFromDisplay = $derived.by(() =>
	groupReasoningModelsFromDisplay(modelsDisplay)
);
const reasoningBaseGroups = $derived.by(() =>
	usesVariantSelector
		? reasoningBaseGroupsFromDisplay.length > 0
			? reasoningBaseGroupsFromDisplay
			: groupCodexModelsByBase(availableModels)
		: []
);
```

## Why This Matters

`modelsDisplay` is presentation data. Labels are presentation data. The Acepe local session id is local identity. None of those should become the hidden authority for provider lifecycle policy, grouped-model identity, or provider replay semantics.

Once shared code starts “figuring out” provider behavior from UI projection or labels, three bad things happen:

1. shared runtime code silently depends on presentation shape,
2. override and resume flows drift from the effective provider actually in use,
3. new providers have to preserve accidental heuristics instead of implementing a clear contract.

The explicit `providerMetadata` seam fixes that. The frontend can still render provider marks and grouped selectors from `modelsDisplay`, but policy now comes from typed provider metadata, grouped identity comes from model ids, and replay identity comes from `history_session_id`. That is the difference between provider-neutral styling and genuinely agent-agnostic architecture.

## When to Apply

- When a reconnect or resume flow needs provider lifecycle behavior such as launch-profile vs post-connect autonomous handling
- When a flow supports `agentOverrideId` or any other effective-provider redirect
- When backend model projection groups variants for display
- When shared UI components are tempted to parse provider-specific ids instead of consuming projected groups
- When a provider stores or replays history under a provider-owned session identity that can differ from the local Acepe session id

## Examples

**Bad:** treating UI projection as lifecycle authority

```ts
const cachedModelsDisplay = modelsDisplay ?? preferencesStore.getCachedModelsDisplay(agentId);
return resolveProviderMetadataProjection(
	agentId,
	getProviderMetadataFromModelsDisplay(cachedModelsDisplay),
	agentId
);
```

This makes reconnect behavior depend on display projection.

**Better:** cache and consume explicit provider metadata

```ts
preferencesStore.updateProviderMetadataCache(effectiveAgentId, providerMetadata);
preferencesStore.updateModelsDisplayCache(
	effectiveAgentId,
	modelsDisplay,
	providerMetadata
);
```

`modelsDisplay` stays presentation-oriented, while provider policy is cached separately and reused by reconnect logic.

**Bad:** using display labels as grouped-model identity

```ts
modelsDisplay.groups.find(
	(group) => normalize(group.label) === normalize(currentModelId)
)
```

**Better:** derive stable group identity from backend model ids and compare against provider/base ids.

Regression coverage that now guards this boundary:

- `packages/desktop/src/lib/acp/store/services/session-connection-manager.test.ts`
- `packages/desktop/src/lib/acp/components/__tests__/model-selector-structure.test.ts`
- `packages/desktop/src/lib/acp/store/provider-metadata.contract.test.ts`
- `packages/desktop/src-tauri/src/history/commands/session_loading.rs` (`provider_owned_history_lookup_uses_provider_session_identity`)
- `packages/desktop/src-tauri/src/storage/types.rs` (`user_setting_key_accepts_additional_keys`)
- `packages/desktop/src-tauri/src/acp/parsers/provider_capabilities.rs` (`provider_capabilities_capture_plan_and_frontend_projection_contracts`)

## Related

- `docs/solutions/logic-errors/operation-interaction-association-2026-04-07.md` — same architectural rule at a narrower operation/interaction boundary
- `docs/solutions/logic-errors/worktree-session-restore-2026-03-27.md` — related identity-preservation work across restore boundaries
- `docs/solutions/logic-errors/kanban-live-session-panel-sync-2026-04-02.md` — related “one runtime owner, many projections” drift
