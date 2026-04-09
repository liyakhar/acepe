---
title: Normalize sparse Copilot permission requests before UI handling
date: 2026-04-09
category: integration-issues
module: desktop ACP inbound permissions
problem_type: integration_issue
component: assistant
symptoms:
  - Copilot panel showed: Tool permission request failed: Error: Stream closed
  - Permission approval prompts did not appear in the Acepe desktop UI
  - Sparse session/request_permission payloads were dropped before normalization
root_cause: wrong_api
resolution_type: code_fix
severity: high
related_components:
  - inbound-request-handler
  - acp-event-bridge
  - permission-store
  - copilot provider integration
tags:
  - copilot
  - permissions
  - acp
  - json-rpc
  - tauri
  - zod
  - inbound-parser
---

# Normalize sparse Copilot permission requests before UI handling

## Problem

GitHub Copilot permission requests were reaching Acepe, but some of them arrived as sparse `session/request_permission` payloads that the frontend rejected before they could become canonical `PermissionRequest` objects. The user-visible result was a missing approval prompt followed by a Copilot failure message about the permission stream closing.

## Symptoms

- Copilot panel showed: `Tool permission request failed: Error: Stream closed`
- No approval prompt appeared in the Tauri UI
- Rust-side forwarding looked healthy, which initially made the issue look like a bridge or lifecycle problem
- Requests missing `options`, `toolCall.toolCallId`, or `toolCall.rawInput` failed at the frontend schema boundary

## What Didn't Work

- Treating the issue as a Tauri MCP or EventSource transport bug
- Assuming every provider would send fully populated permission payloads
- Relying on the Rust forwarding layer being tolerant while leaving the frontend schema strict
- Requiring UI-facing enrichment fields at the transport boundary instead of synthesizing safe defaults

## Solution

Relax the frontend inbound permission schema so sparse provider payloads are accepted, then normalize them into the stricter internal shape Acepe uses downstream.

Changed files:

- `packages/desktop/src/lib/acp/schemas/inbound-request.schema.ts`
- `packages/desktop/src/lib/acp/logic/inbound-request-normalization.ts`
- `packages/desktop/src/lib/acp/logic/__tests__/inbound-request-normalization.test.ts`

Key changes:

1. `options` became optional and now defaults to `[]`
2. `toolCall` can be missing or sparse
3. `rawInput` defaults to `{}`
4. missing `toolCallId` is synthesized as `permission-request-<requestId>`

```ts
const ToolCallSchema = SparseToolCallSchema.optional().transform((toolCall) => ({
	toolCallId: toolCall?.toolCallId,
	rawInput: toolCall?.rawInput ?? {},
	parsedArguments: toolCall?.parsedArguments,
	title: toolCall?.title,
	name: toolCall?.name,
}));

export const RequestPermissionParamsSchema = z.object({
	sessionId: z.string(),
	options: z.array(PermissionOptionSchema).optional().default([]),
	toolCall: ToolCallSchema,
});
```

```ts
function getNormalizedToolCallId(
	request: JsonRpcRequest,
	toolCall: RequestPermissionParams["toolCall"]
): string {
	if (toolCall.toolCallId !== undefined) {
		return toolCall.toolCallId;
	}

	return `permission-request-${request.id}`;
}
```

Regression coverage now includes a sparse Copilot-shaped payload:

```ts
params: {
	sessionId: "session-15",
	toolCall: {
		name: "Write",
	},
}
```

## Why This Works

Acepe now treats the provider payload as a compatibility boundary instead of assuming it already matches the app’s richer UI contract. The parser accepts the minimal transport data Copilot can legally send, fills in safe defaults, and hands the rest of the app a deterministic canonical `PermissionRequest`.

That keeps the strictness where it belongs: after normalization, not before it.

## Prevention

- Add regression tests for sparse provider-shaped payloads, not just ideal fully populated fixtures
- Parse loosely at provider boundaries and normalize strictly into Acepe-owned contracts
- Keep frontend parser defaults aligned with backend forwarding tolerance so one side does not silently drop valid requests
- When a permission flow spans Rust forwarding, frontend parsing, and UI rendering, add tests that cover the whole contract seam instead of only one layer
- If a provider can omit transport metadata like `toolCallId`, synthesize a stable fallback before the request reaches UI ownership code

## Related Issues

- `docs/solutions/logic-errors/operation-interaction-association-2026-04-07.md` — related permission/tool ownership mismatch guidance below the UI boundary
- `docs/solutions/best-practices/provider-owned-policy-and-identity-not-ui-projections-2026-04-09.md` — related rule about consuming provider-owned contracts instead of reconstructing them in UI code
- No related GitHub issues were found for this exact failure path
