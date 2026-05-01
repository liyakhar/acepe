---
date: 2026-05-01
plan_id: 003
title: "refactor: Retire ToolCallRouter"
slug: retire-toolcallrouter
type: refactor
status: active
posture: deep
---

## Review-Driven Revisions

**Review verdict:** BLOCK — 2 P0 blockers, 3 P1 caveats. Resolved in revision 1. Second-pass review found 3 additional P0 blockers (missed import-map entries); resolved in revision 2. Third-pass review found 1 P1 (code snippet needs type narrowing for parent entry before `.taskChildren` access) and 1 auto-fixed P2 (retained test files not listed in keep list). P1 recorded below; ready with caveat. See individual findings below.

| Finding | Resolution | Section(s) touched |
|---------|-----------|-------------------|
| P0-A: `tool-call-edit/` entire-directory deletion breaks live consumers | Relocation sub-step added to Unit 4: `logic/` and `constants/` moved to `packages/desktop/src/lib/acp/utils/tool-call-edit/` before deletion; 3 import sites listed. `tool-call-execute/`, `tool-call-fetch/`, `tool-call-search/` narrowed: specific logic/type files with out-of-scope consumers explicitly retained. | Unit 4 Files, Approach, Verification; new Pre-deletion import map table |
| P0-B: `activity-entry-projection.ts` still imports `convertTaskChildren` after Unit 2 | Unit 2 now includes inlining `convertTaskChildren` into `activity-entry-projection.ts` via parent-entry extraction approach; `convert-task-children.ts` drained of its out-of-scope consumer before Unit 4 deletes it | Unit 2 Files, Approach, Verification |
| P1-A: `mapToolCallToSceneEntry` returns `AgentPanelSceneEntryModel`, not `AgentToolEntry` | Use parent-entry extraction + type guard `(e): e is AgentToolEntry => e.type === "tool_call"` to narrow; all task children are guaranteed tool_call entries | Unit 2 Approach |
| P1-B: `activeToolCallId=null` always returns `status: "done"` for in-progress tools | `activity-entry-projection.ts` uses parent-entry extraction so `mapTaskChildren` handles active-child detection internally. `virtual-session-list.svelte` accepts `done` regression for ops view; added to parity gap table | Unit 1 Approach/Verification; Unit 2 Approach; Parity Gap table |
| P1-C: `question` ToolKind display-only contract unspecified | Display Contracts subsection added; option (a) confirmed: `AgentPanelConversationEntry` passes `isInteractive={entry.status === "running"}` with no callbacks — options shown but inert when not running. `create_plan` with `normalizedQuestions` follows the same path (verified P2-3) | New Display Contracts subsection; Parity Gap table updated |
| P1-D: `semantic-tool-rendering.test.ts` listed in BOTH Unit 3 and Unit 4 | Investigated: file appears only in Unit 4 Files (line 312) and in Key Technical Decisions as contextual description (line 92). Unit 3 does not list it for deletion. No change needed — already correct | No change |
| P2-1: R5 only assigned to Unit 4 | R5 added to Requirements in Units 1, 2, 3 | Units 1, 2, 3 Requirements |
| P2-2: R5 "deleted tests replaced with equivalent coverage" unverified | Concrete test obligation added to Unit 2 Test scenarios: verify `latestTaskSubagentTool.status === "running"` for in-progress task children after migration | Unit 2 Test scenarios |
| P2-3: `create_plan` + `normalizedQuestions` unverified | Verified: `AgentPanelConversationEntry` checks `entry.question` before `entry.kind` (line 58); when `normalizedQuestions` is set, the entry's `question` field is populated by `mapQuestion`, so it routes to `AgentToolQuestion` — not `AgentToolOther`. Folded into P1-C display contract. Parity table updated. | Parity Gap table; Display Contracts subsection |
| P2-4: Untracked dead code (`use-plan-inline.svelte.ts`, `question-selection-store.svelte.ts`) | `use-plan-inline.svelte.ts` is only called from bespoke components being deleted — becomes dead after Unit 4. `question-selection-store.svelte.ts` has live consumers outside the bespoke components (`main-app-view.svelte`, `kanban-view.svelte`, `queue-item.svelte`, `store/index.ts`) — NOT dead after this plan. Scope Boundaries updated accordingly. | Scope Boundaries |
| P0-1 (rev 2): `exit-plan-helpers.ts` deleted but has live consumers | `permission-visibility.ts` (kept file) imports `shouldHidePermissionBarForExitPlan`; `queue/queue-item.svelte` imports `getExitPlanDisplayPlan`. Retained `exit-plan-helpers.ts` and `__tests__/exit-plan-helpers.test.ts`; removed from delete list; added to "Files to keep"; added rows to import map. | Unit 4 Pre-deletion import map, delete list, Files to keep |
| P0-2 (rev 2): `tool-call-web-search/` entirely deleted but has live consumers | `tool-result-normalizer.ts` imports `parseWebSearchResult` from `logic/parse-web-search-result.ts`; `normalized-tool-result.ts` imports `WebSearchResult` from `types/web-search-result.ts`. Applied narrowed-deletion pattern: retain those two files, delete only bespoke UI. Added rows to import map and narrowed-deletion note. | Unit 4 Pre-deletion import map, delete list, Narrowed deletions, Files to keep |
| P0-3 (rev 2): `browser-tool-display.ts` deleted but has live consumer | `tool-result-normalizer.ts` imports `parseBrowserToolResult`. Retained `browser-tool-display.ts`; removed from delete list; added to "Files to keep"; added row to import map. | Unit 4 Pre-deletion import map, delete list, Files to keep |
| P3 (rev 2): parent-entry extraction changes child status for COMPLETED parent tasks | Children of completed parent tasks now receive `parentCompleted=true` instead of `false`. This is the correct new behavior — previously `convertTaskChildren` had no `parentCompleted` concept; the extraction approach adds it intentionally. Noted in Risk Analysis. | Risk Analysis |
| P1 (rev 3): Unit 2 code snippet accesses `parentEntry.taskChildren` without narrowing | `mapToolCallToSceneEntry` returns `AnyAgentEntry`; `taskChildren` only exists on `AgentToolEntry`. Plan's code snippet and `getChildSummary` migration both omit `parentEntry.type === "tool_call"` narrowing before accessing `AgentToolEntry`-specific properties. Implementer must add narrowing at each substitution site. | Unit 2 Approach |
| P2-auto (rev 3): Tests for retained logic files not in "Files to keep" list | `parse-tool-result.test.ts`, `parse-fetch-result.test.ts`, `parse-grep-output.test.ts`, `parse-web-search-result.test.ts` (each in their module's `__tests__/` dir) are tests for retained files. Following `exit-plan-helpers.test.ts` precedent, added to "Files to keep". | Unit 4 Files to keep |

---

# refactor: Retire ToolCallRouter

## Overview

`ToolCallRouter` (`packages/desktop/src/lib/acp/components/tool-calls/tool-call-router.svelte`) is the old per-kind Svelte-component dispatch layer. After the single-render-path refactor (plan 002), the primary agent-panel render path no longer uses it. Its sole remaining live consumer is `virtual-session-list.svelte`, which represents the legacy operations/secondary session view.

This plan switches `virtual-session-list.svelte` to the same scene-driven pipeline already used by `virtualized-entry-list.svelte` (i.e., `mapToolCallToSceneEntry` → `AgentPanelConversationEntry` from `@acepe/ui`), then systematically deletes `ToolCallRouter`, `tool-definition-registry.ts`, all orphaned per-kind bespoke components, and the `resolve-tool-operation.ts` helper that only the router ever called.

## Problem Frame

The agent-panel codebase now has two rendering stacks for tool calls:
- **Scene path** (canonical): `mapToolCallToSceneEntry` → `AgentPanelSceneEntryModel` → `AgentPanelConversationEntry` from `@acepe/ui`. Used by `virtualized-entry-list.svelte` (the main panel).
- **Router path** (legacy): `ToolCallRouter` → `tool-definition-registry.ts` → per-kind bespoke Svelte components. Used only by `virtual-session-list.svelte`.

Maintaining both paths means any rendering fix or new `AgentToolKind` must be applied in two places. The router path also keeps ~25 bespoke Svelte components alive, each importing desktop-runtime stores and Tauri calls, preventing clean `@acepe/ui` extraction of the rendering contract.

## Requirements Trace

**Functional (migration & deletion)**
- R1. `virtual-session-list.svelte` renders tool_call entries via `AgentPanelConversationEntry` (scene path), not `ToolCallRouter`.
- R2. `tool-call-router.svelte` is deleted with no live references remaining.
- R3. `tool-definition-registry.ts` is deleted; its data-mapper consumers (`activity-entry-projection.ts`, `convert-task-children.ts`) migrate to `mapToolCallToSceneEntry` from the canonical scene mapper.
- R4. All per-kind bespoke components that were exclusively consumed through the registry are deleted.

**Quality gate (per-unit)**
- R5. `bun run check` passes clean after every unit; all existing tests pass (or deleted tests are replaced with behaviorally equivalent coverage).

**Scope preservation**
- R6. The permission-related components in `tool-calls/` (`permission-bar.svelte`, `permission-action-bar.svelte`, `pending-permission-card.svelte`, `permission-display.ts`, `permission-visibility.ts`) are unaffected — they have separate live consumers.

## Scope Boundaries

- **Not in scope:** adding new `AgentToolKind` values or new rendering modes for any ToolKind.
- **Not in scope:** modifying the main agent-panel render path (`virtualized-entry-list.svelte`, `agent-panel.svelte`, or `desktop-agent-panel-scene.ts` beyond the minimal consumer-migration needed in Unit 2).
- **Not in scope:** the 4 send paths, optimistic entries, or operation-store shape.
- **Not in scope:** `session-view.svelte`'s scroll logic, or any message components (`UserMessage`, `AssistantMessage`, `AskMessage`) — only the `tool_call` branch of `virtual-session-list.svelte` changes.
- **Not in scope:** deleting `use-plan-inline.svelte.ts` (becomes dead code after Unit 4 deletes its only callers — the bespoke components; removal is a separate cleanup task).
- **Not in scope:** deleting `question-selection-store.svelte.ts` — this file has live consumers outside the bespoke components (`main-app-view.svelte`, `kanban-view.svelte`, `queue-item.svelte`, `store/index.ts`) and is NOT dead code after this plan. No deletion of this file in any unit.

## Parity Gap Verdict

The 7 `ToolKind` values mapped to `"other"` in `toAgentToolKind` have the following gap analysis:

| ToolKind | Registry rendering today | Scene path result | Gap verdict |
|---|---|---|---|
| `todo` | `AgentToolTodo` (via `ToolCallTodo`) | `AgentToolTodo` — scene mapper sets `todos` field; `AgentPanelConversationEntry` data-routes on `todos.length > 0` | ✅ Zero parity gap |
| `question` | Fully interactive `AgentToolQuestion` (with `onSelect`/`onSubmit` callbacks via stores) | `AgentToolQuestion` display-only — `AgentPanelConversationEntry` passes `isInteractive={entry.status === "running"}` and no `onSelect`/`onSubmit`; options rendered but inert (see Display Contracts). | ⚠️ Interactivity regression in the ops view. Accepted: the primary interactive surface is `agent-panel.svelte`, not `virtual-session-list.svelte`. |
| `move` | `ToolCallFallback` → `AgentToolRow` (no bespoke component in registry) | `AgentToolOther` (kind `"other"` → `AgentToolOther` in `AgentPanelConversationEntry`) | ✅ Equivalent best-effort generic |
| `enter_plan_mode` | `ToolCallEnterPlanMode`: Tauri-specific actions (open in Finder, view-plan sidebar toggle) | `AgentToolOther(title="Entered plan mode")` | ⚠️ Platform actions lost. Accepted for ops view. |
| `exit_plan_mode` | `ToolCallExitPlanMode`: `PlanCard` with permission-gated approval, keyboard shortcut, sidebar auto-open | `AgentToolOther` | ⚠️ Approval UI lost. Accepted: approval is owned by main panel. |
| `create_plan` | `ToolCallCreatePlan`: `PlanCard` with plan approval interaction | `AgentToolOther` normally; if `normalizedQuestions` is non-empty, `mapQuestion` populates `entry.question` and `AgentPanelConversationEntry` routes to `AgentToolQuestion` (verified: entry.question check precedes kind check at line 58 of conversation-entry.svelte). Same display-only contract applies: `isInteractive={entry.status === "running"}`, no callbacks (see Display Contracts). | ⚠️ Interactive approval lost for `create_plan`. When questions present, renders display-only `AgentToolQuestion`. Accepted: same rationale as `exit_plan_mode`. |
| `tool_search` | `ToolCallToolSearch`: query + parsed matched tool name chips | `AgentToolOther(title, subtitle, detailsText=serialized_result)` | ⚠️ Parsed chip display → raw details text. Acceptable. |

Additional non-"other" kinds with minor regressions:

| ToolKind | Registry rendering today | Scene path result | Gap verdict |
|---|---|---|---|
| `delete` | `ToolCallDelete`: custom card, Trash icon, multi-file `FilePathBadge` list | `AgentToolRow(title, filePath[0])` — only first file surfaced | ⚠️ Multi-file case loses additional file badges. Accepted. |

Additional regressions introduced by the scene pipeline (P1-B):

| Context | Regression | Verdict |
|---------|-----------|---------|
| Any `in_progress` tool call in `virtual-session-list.svelte` (ops view) | `mapToolCallToSceneEntry(toolCall, turnState, false, null)` passes `activeToolCallId=null`; `mapToolStatus` returns `"done"` for all non-active tools. In-progress tools render as `done` instead of `running` in the ops view. | ⚠️ Accepted: ops view shows historical/secondary data. The primary running-tool indication is in `agent-panel.svelte`. `null` is used because `virtual-session-list.svelte` has no `activeToolCallId` prop and threading it would require a new prop chain and store access. |

**Total bespoke `@acepe/ui` ports required: 0.** All regressions are scoped to the secondary `virtual-session-list.svelte` ops view and are explicitly accepted.

## Display Contracts

> Documents the precise rendering behavior of ToolKinds that have interactivity in the registry path but are display-only after this migration.

### `question` ToolKind and `create_plan` with `normalizedQuestions`

Both cases produce an entry with a non-null `question` field in the scene model. `AgentPanelConversationEntry` routes to `AgentToolQuestion` when `isToolCall(entry) && entry.question` (checked before `kind === "other"`, so `create_plan`'s `kind: "other"` does not matter).

`AgentPanelConversationEntry` renders `AgentToolQuestion` with:
- `questions={[entry.question]}` — answer options populated from `normalizedQuestions`
- `status={entry.status}` — the entry's computed status
- `isInteractive={entry.status === "running"}` — only `true` when the tool is the active streaming tool call
- No `onSelect` or `onSubmit` callbacks wired (not passed by `AgentPanelConversationEntry`)

**Resulting display contract (Option A):**
- When `status === "done"` (i.e., in the ops view via `activeToolCallId=null`): `isInteractive=false`. Options are rendered visually but `onclick` is gated by `isInteractive &&` — clicks have no effect. No `onAnswer` callback is missing because none is expected.
- When `status === "running"` (hypothetically, if active id were threaded): `isInteractive=true`, but `onSelect=undefined` → calls `undefined?.()` → no-op. Same visible-but-inert result.
- No `@acepe/ui` component change required — the existing `isInteractive` gate already provides option (a) behavior.

This is an acceptable regression: question answering is owned by `agent-panel.svelte` (the primary panel), not by the ops view.

## Context & Research

### Relevant Code and Patterns

- **Scene mapper**: `packages/desktop/src/lib/acp/components/agent-panel/scene/desktop-agent-panel-scene.ts` — `mapToolCallToSceneEntry(toolCall, turnState, parentCompleted, activeToolCallId)` returns `AgentPanelSceneEntryModel` (which satisfies the `AgentToolEntry` union).
- **Canonical renderer**: `packages/ui/src/components/agent-panel/agent-panel-conversation-entry.svelte` — `AgentPanelConversationEntry` takes `entry: AgentPanelConversationEntry` and `iconBasePath`. All 17 `AgentToolKind` values are covered.
- **Existing scene consumer**: `packages/desktop/src/lib/acp/components/agent-panel/components/virtualized-entry-list.svelte` — the migration target's render pattern. Tool call entries are mapped via `mapVirtualizedDisplayEntryToConversationEntry` then passed to `AgentPanelConversationEntry`.
- **Registry consumers to migrate**: `packages/desktop/src/lib/acp/components/activity-entry/activity-entry-projection.ts` (uses `resolveFullToolEntry`, `resolveCompactToolDisplay`, `compactAgentToolEntry`) and `packages/desktop/src/lib/acp/components/tool-calls/tool-call-task/logic/convert-task-children.ts` (uses `resolveFullToolEntry`).
- **Permission components (keep)**: `packages/desktop/src/lib/acp/components/tool-calls/permission-bar.svelte`, `permission-action-bar.svelte`, `pending-permission-card.svelte`, `permission-display.ts`, `permission-visibility.ts` — consumed by `agent-panel-pre-composer-stack.svelte`, `queue-item.svelte`, `kanban-view.svelte`, `session-item.svelte`. These must not be deleted.
- **Exports to update**: `packages/desktop/src/lib/acp/components/tool-calls/index.ts` (re-exports the router and bespoke components), `packages/desktop/src/lib/acp/components/index.ts` (`export * from "./tool-calls/index.js"`).

### Institutional Learnings

- Check `docs/solutions/` for agent-panel rendering and scene-model patterns before implementing Unit 1.

## Key Technical Decisions

- **Keep `UserMessage`, `AssistantMessage`, `AskMessage` branches unchanged**: Only the `tool_call` branch of `virtual-session-list.svelte` changes. The other branches use streaming animation and reveal logic not yet in `@acepe/ui`.
- **Use `mapToolCallToSceneEntry` directly (not `mapSessionEntryToConversationEntry`)**: `virtual-session-list.svelte` already knows `entry.type === "tool_call"` at the render site. Calling `mapToolCallToSceneEntry(entry.message as ToolCall, turnState, false, null)` is direct and avoids redundant type checks.
- **`resolveFullToolEntry` → `mapToolCallToSceneEntry`**: The registry's `resolveFullToolEntry` returns `AgentToolEntry` directly; `mapToolCallToSceneEntry` returns `AgentPanelSceneEntryModel` (a union). For tool_call inputs the concrete return is always an `AgentToolEntry`, but TypeScript sees only the union. Callers that need `AgentToolEntry` must use a type guard — see Unit 2 approach for the chosen pattern.
- **`resolveCompactToolDisplay` migration**: `activity-entry-projection.ts` uses compact display for the activity strip. After migrating to `mapToolCallToSceneEntry`, the same compaction logic can be applied inline (extracting `id`, `kind`, `title`, `filePath`, `status` from the full scene entry). No new exported utility needed.
- **Delete `toAgentToolKind` and `tool-kind-to-agent-tool-kind.ts`**: After all bespoke components and the registry are gone, `toAgentToolKind` has no production consumers. Its tests (`semantic-tool-rendering.test.ts`, `tool-kind-to-agent-tool-kind.test.ts`) test the mapper in isolation. Delete them together with the mapper.
- **Retain `tool-calls/index.ts`**: After deletions, it still exports the permission components that external consumers depend on.

## Open Questions

### Resolved During Planning

- **Are the bespoke components consumed anywhere besides `tool-definition-registry.ts`?** No. Grep confirms `ToolCallEdit`, `ToolCallExecute`, `ToolCallFallback`, etc. have zero consumers outside `tool-calls/`. The export through `components/index.ts` propagates them publicly, but no file outside the package imports them by their exported name (confirmed by grep).
- **Is `tool-call-question.svelte` interactive answering needed in `virtual-session-list.svelte`?** The `question` ToolKind enters the ops view as a historical record, not a live interaction point. The primary question answering surface is `agent-panel.svelte`. Acceptable regression.
- **Does `activity-entry-projection.ts` need `resolveCompactToolDisplay` semantics exactly?** The compact display strips an `AgentToolEntry` to `{ id, kind, title, filePath, status }` with a `filePath`-conditional title fallback. This is a pure field selection expressible inline without a shared utility.
- **Are `content/` and `shared/` subdirectories within `tool-calls/` used outside the bespoke components?** No external consumers confirmed by grep. Both are deleted in Unit 4.
- **Is `resolve-tool-operation.ts` used anywhere besides `tool-call-router.svelte`?** Grep confirms: used only by the router. Deleted with it.

### Deferred to Implementation

- Exact titles and subtitles the scene mapper produces for `enter_plan_mode`, `exit_plan_mode`, `create_plan`, `tool_search` in the rendered output (verify during implementation via `bun run check` + visual spot-check in dev).
- Whether any bespoke component subdirectory contains logic files imported transitively by non-component code not caught by the grep. Implementer should run `bun run check` after each deletion batch and fix any dangling imports.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
BEFORE:
virtual-session-list.svelte
  tool_call branch → ToolCallRouter
                      └─ getToolDefinition(toolCall) from tool-definition-registry.ts
                          └─ TOOL_DEFINITIONS[kind].component
                              └─ ToolCallEdit | ToolCallRead | ... | ToolCallFallback

AFTER:
virtual-session-list.svelte
  tool_call branch → mapToolCallToSceneEntry(toolCall, turnState)   ← scene mapper
                      └─ AgentPanelConversationEntry(entry)           ← @acepe/ui
                          └─ kind-dispatch already there (same as virtualized-entry-list.svelte)
```

Consumer migration (R3):
```
activity-entry-projection.ts
  resolveFullToolEntry(opts)     → mapToolCallToSceneEntry(toolCall, turnState, parentCompleted)
  resolveCompactToolDisplay(opts) → mapToolCallToSceneEntry(...) then inline compact fields
  compactAgentToolEntry(entry)    → inline field selection (id, kind, title, filePath, status)

convert-task-children.ts
  resolveFullToolEntry(opts)     → mapToolCallToSceneEntry(toolCall, turnState, parentCompleted)
```

Deletion sequence (ensures each step compiles):
```
Unit 1: virtual-session-list.svelte migrated (router import removed)
Unit 2: activity-entry-projection.ts and convert-task-children.ts migrated
Unit 3: tool-call-router.svelte + resolve-tool-operation.ts + tool-definition-registry.ts deleted
Unit 4: all per-kind bespoke components deleted (now zero consumers)
        tool-kind-to-agent-tool-kind.ts deleted (now zero consumers)
        tool-calls/index.ts updated to export only permission components
```

## Implementation Units

- [ ] **Unit 1: Switch virtual-session-list.svelte tool_call branch to scene pipeline**

**Goal:** Replace the `ToolCallRouter` render branch in `virtual-session-list.svelte` with `mapToolCallToSceneEntry` + `AgentPanelConversationEntry`. Remove the `ToolCallRouter` import.

**Requirements:** R1, R5

**Dependencies:** None — this is the first change.

**Files:**
- Modify: `packages/desktop/src/lib/acp/components/virtual-session-list.svelte`

**Approach:**
- In the `{:else if entry.type === "tool_call"}` branch, replace `<ToolCallRouter toolCall={entry.message as ToolCall} {turnState} {projectPath} />` with: call `mapToolCallToSceneEntry(entry.message as ToolCall, turnState, false, null)` to produce a scene entry, then render via `<AgentPanelConversationEntry entry={sceneEntry} iconBasePath="/svgs/icons" />`.
- **P1-B: `activeToolCallId=null` is intentional for the ops view.** Passing `null` means in-progress tools render with `status: "done"` instead of `"running"`. This is an accepted regression for `virtual-session-list.svelte` (see updated parity gap table). The primary running-tool indication lives in `agent-panel.svelte`. Threading the active id would require a new prop and store access, which is out of scope.
- `mapToolCallToSceneEntry` is exported from `packages/desktop/src/lib/acp/components/agent-panel/scene/desktop-agent-panel-scene.ts`. Import it by path (not via a re-export barrel).
- `AgentPanelConversationEntry` is exported from `@acepe/ui` (via `@acepe/ui/agent-panel` or the top-level `@acepe/ui` barrel).
- The `entry.message as ToolCall` cast already existed for the old `ToolCallRouter` prop; preserve it.
- The `projectPath` prop is no longer needed by the tool_call branch after this change (the scene entry contains no `projectPath` concept). If `projectPath` is still used by other branches (`AssistantMessage`), keep the prop; just stop forwarding it to the tool call renderer.
- The `$effect` for `nowMs` (interval timer for elapsed label) inside `tool-call-router.svelte` is encapsulated there. `AgentPanelConversationEntry` does not have an elapsed-label timer. This is an acceptable regression for the ops view (no live elapsed label). The `turnState`-based status rendering in the scene mapper still correctly marks running vs done.
- Leave `UserMessage`, `AssistantMessage`, `AskMessage` branches untouched.
- Run `bun run check` from `packages/desktop`.

**Patterns to follow:**
- `packages/desktop/src/lib/acp/components/agent-panel/components/virtualized-entry-list.svelte` — how it calls `mapVirtualizedDisplayEntryToConversationEntry` and passes the result to `AgentPanelConversationEntry`.

**Test scenarios:**
- Test expectation: none — this is a rendering pipeline swap, not a new behavior. Verification is by visual spot-check and type-check.

**Verification:**
- `bun run check` passes from `packages/desktop`.
- `bun test` passes from `packages/desktop` (no test files change in this unit; verifies no pre-existing test regressions).
- `virtual-session-list.svelte` has no `ToolCallRouter` import.
- Opening `session-view.svelte` in dev shows `tool_call` entries rendered as `AgentPanelConversationEntry` widgets (read/edit/execute/etc. familiar shapes).
- Note: in-progress tools in the ops view will render with `status: "done"` label — this is the accepted P1-B regression; no fix needed.

---

- [ ] **Unit 2: Migrate activity-entry-projection.ts and convert-task-children.ts to scene mapper**

**Goal:** Remove all uses of `resolveFullToolEntry`, `resolveCompactToolDisplay`, `compactAgentToolEntry`, and `convertTaskChildren` from all live consumers, replacing them with `mapToolCallToSceneEntry` from the canonical scene mapper. This drains the last production consumers of `tool-definition-registry.ts` and removes `activity-entry-projection.ts`'s dependency on `convert-task-children.ts` before Unit 4 deletes `tool-call-task/`.

**Requirements:** R3, R5

**Dependencies:** Unit 1 (establishes the scene path as the single canonical source; not technically required but avoids confusion during review).

**Files:**
- Modify: `packages/desktop/src/lib/acp/components/activity-entry/activity-entry-projection.ts`
  - Remove: `convertTaskChildren` import (line 13) and call site (line 221)
  - Remove: `CompactToolDisplay`, `compactAgentToolEntry`, `resolveCompactToolDisplay`, `resolveFullToolEntry` from `tool-definition-registry.js`
  - Add: import of `mapToolCallToSceneEntry` and `type AgentToolEntry` from `../agent-panel/scene/desktop-agent-panel-scene.js`
- Modify: `packages/desktop/src/lib/acp/components/tool-calls/tool-call-task/logic/convert-task-children.ts`
  - This file's only out-of-scope consumer is `activity-entry-projection.ts`; after this unit, it becomes internally consumed only by `tool-call-task/` files, which are deleted in Unit 4.

**Approach:**

*P1-A + P1-B resolution — type narrowing and active-child status:*

`mapToolCallToSceneEntry` returns `AgentPanelSceneEntryModel` (a union type), but `taskSubagentTools: readonly AgentToolEntry[]` requires the narrower `AgentToolEntry`. Direct substitution (`rawChildren.map(child => mapToolCallToSceneEntry(...))`) would not type-check. Additionally, passing `activeToolCallId=null` causes the scene mapper's `mapToolStatus` to return `"done"` for all in-progress children, breaking the `status: "running"` contract for the active child.

**Chosen resolution (avoids both issues):** instead of mapping children individually, call `mapToolCallToSceneEntry` on the *parent* task tool call and extract its `taskChildren` from the result. The scene mapper's internal `mapTaskChildren` + `getActiveTailToolCallId` handle active-child detection correctly and produce the right `"running"` status for the active tail child. Then narrow with the type guard `(e): e is AgentToolEntry => e.type === "tool_call"` (all task children are `tool_call` entries; this guard mirrors the one already used in `agent-tool-task.svelte`).

*`convert-task-children.ts`:*
- Replace `import { resolveFullToolEntry } from "../../tool-definition-registry.js"` with an import of `mapToolCallToSceneEntry` from `../../agent-panel/scene/desktop-agent-panel-scene.js` (adjust relative path from `tool-call-task/logic/`).
- Replace `resolveFullToolEntry({ toolCall: child, turnState, parentCompleted })` with `mapToolCallToSceneEntry(child, turnState, parentCompleted)`.
- Return type annotation `AgentToolEntry[]` must become `AgentPanelSceneEntryModel[]` OR the caller must apply the type guard. Since `activity-entry-projection.ts` will stop calling this function after this unit, the file's return type annotation can be updated to `AgentPanelSceneEntryModel[]` for accuracy — it will be deleted in Unit 4 regardless.

*`activity-entry-projection.ts`:*
- Remove imports: `CompactToolDisplay`, `compactAgentToolEntry`, `resolveCompactToolDisplay`, `resolveFullToolEntry` from `../tool-calls/tool-definition-registry.js`.
- Remove import of `convertTaskChildren` from `../tool-calls/tool-call-task/logic/convert-task-children.js`.
- Add import of `mapToolCallToSceneEntry` from `../agent-panel/scene/desktop-agent-panel-scene.js`.
- Add import of `type AgentToolEntry` from `@acepe/ui/agent-panel` (already used as a return-type annotation; confirm it's imported).
- **`convertTaskChildren(rawChildren, turnState)` call site (line 221):** replace with:
  ```ts
  const parentEntry = mapToolCallToSceneEntry(toolCall, turnState, false);
  const convertedChildren = (parentEntry.taskChildren ?? []).filter(
    (e): e is AgentToolEntry => e.type === "tool_call"
  );
  ```
  where `toolCall` is the task tool call that owns the children. Confirm the variable name matches the local context in `activity-entry-projection.ts`.
- `resolveFullToolEntry(opts)` call sites → `mapToolCallToSceneEntry(opts.toolCall, opts.turnState, opts.parentCompleted ?? false)`. The result is `AgentPanelSceneEntryModel`; if the result is used as `AgentToolEntry`, apply the type guard or a narrowing cast (safe for tool_call inputs).
- **`getChildSummary` (line ~170):** This helper has no `turnState` in scope. Replace `resolveFullToolEntry({ toolCall: child })` with `mapToolCallToSceneEntry(child, undefined, false)` — `turnState: TurnState | undefined` is a valid argument and matches the existing no-turnState semantics of the old `resolveFullToolEntry({ toolCall: child })` call.
- `resolveCompactToolDisplay(opts)` → call `mapToolCallToSceneEntry(...)` then project to compact shape inline: `{ id: entry.id, kind: entry.kind, title: entry.filePath ? entry.title : (entry.subtitle ?? entry.title), filePath: entry.filePath, status: entry.status }`. This mirrors the exact logic from `compactToolEntry` in the registry.
- `compactAgentToolEntry(entry)` → same inline projection as above.
- If `CompactToolDisplay` type is referenced in return-type annotations, either define it locally or use `Pick<AgentToolEntry, "id" | "kind" | "title" | "filePath" | "status">` inline (check whether `@acepe/ui/agent-panel` exports it first).
- Run `bun run check` from `packages/desktop`.

**Patterns to follow:**
- `agent-tool-task.svelte` line 66 for the type guard pattern: `.filter((e): e is AgentToolEntry => e.type === "tool_call")`.
- Existing call sites in `activity-entry-projection.ts` (lines ~170, ~239, ~318, ~326) provide the call signature context.
- The `compactToolEntry` logic is visible at the top of `tool-definition-registry.ts` — mirror it inline.

**Test scenarios:**
- **(P2-2 test obligation)** `activity-entry-projection.test.ts` currently asserts `latestTaskSubagentTool.status === "running"` for a streaming task with an in-progress child (line ~118). After migration to the parent-entry extraction approach, this test must continue to pass — the internal `getActiveTailToolCallId` in the scene mapper correctly identifies the active tail child and sets `"running"` for it. Verify this test still passes after the change (do not modify the test).
- If `activity-entry-projection` has additional unit tests, verify they all pass unchanged.

**Verification:**
- `bun run check` passes from `packages/desktop`.
- `bun test` passes from `packages/desktop`; the `activity-entry-projection.test.ts` suite passes including the `status: "running"` assertion.
- `activity-entry-projection.ts` has no import from `tool-definition-registry.js` or `convert-task-children.js`.
- `tool-definition-registry.ts` has no remaining production imports (only its own test files import it).
- Activity strip and task subagent summaries continue to display correctly.

---

- [ ] **Unit 3: Delete tool-call-router.svelte, resolve-tool-operation.ts, and tool-definition-registry.ts**

**Goal:** Remove the router, its helper, and the registry — the three core infrastructure files of the old dispatch layer — now that they have zero production consumers.

**Requirements:** R2, R3, R5

**Dependencies:** Unit 1 (router import removed from virtual-session-list.svelte), Unit 2 (registry consumers migrated).

**Files:**
- Delete: `packages/desktop/src/lib/acp/components/tool-calls/tool-call-router.svelte`
- Delete: `packages/desktop/src/lib/acp/components/tool-calls/resolve-tool-operation.ts`
- Delete: `packages/desktop/src/lib/acp/components/tool-calls/tool-definition-registry.ts`
- Delete: `packages/desktop/src/lib/acp/components/tool-calls/__tests__/tool-definition-registry.test.ts`
- Delete: `packages/desktop/src/lib/acp/components/tool-calls/__tests__/build-agent-tool-entry.test.ts`
- Delete: `packages/desktop/src/lib/acp/components/tool-calls/__tests__/resolve-tool-operation.test.ts`
- Modify: `packages/desktop/src/lib/acp/components/tool-calls/index.ts` — remove `ToolCallRouter`, `ToolCallFallback`, `ToolCallEdit`, `ToolCallExecute`, `ToolCallSearch`, `ToolCallThink`, `ToolCallFooter` exports (these reference not-yet-deleted files; removing the exports first prevents broken re-export). Note: `tool-calls/index.ts` currently has **no** permission component exports — permission components are imported directly by path by their consumers. After removing the 7 bespoke exports, the file will be effectively empty until Unit 4 rewrites it to add the permission component exports.

**Approach:**
- Delete the three target files.
- Open `tool-calls/index.ts` and remove the named exports for `ToolCallRouter`, `ToolCallFallback`, `ToolCallEdit`, `ToolCallExecute`, `ToolCallSearch`, `ToolCallThink`, `ToolCallFooter`. The remaining bespoke components are not exported from this file (confirmed: only the above 7 appear in `index.ts`; no other bespoke or permission exports exist in the barrel).
- Remove the three corresponding test files.
- Run `bun run check` from `packages/desktop`; fix any dangling imports from files other than bespoke components (if found).
- Run `bun test` from `packages/desktop`; confirm suite still passes (deleted tests reduce the suite count, no failures).

**Test scenarios:**
- Test expectation: none — this is file deletion. Verification is by type-check and test run.

**Verification:**
- `bun run check` passes.
- `bun test` passes.
- `grep -r "ToolCallRouter\|tool-call-router\|tool-definition-registry\|resolveFullToolEntry\|resolveCompactToolDisplay" packages/desktop/src --include="*.ts" --include="*.svelte"` returns no matches (except stale string literals in non-import test fixtures).

---

- [ ] **Unit 4: Delete orphaned bespoke per-kind components and clean up tool-calls/**

**Goal:** Delete all bespoke per-kind Svelte components and their support files that are now dead code after Unit 3. Relocate surviving logic/constants from `tool-call-edit/` before deletion. Narrow deletion for `tool-call-execute/`, `tool-call-fetch/`, `tool-call-search/` to retain files with out-of-scope consumers. Update `tool-calls/index.ts` to export only the surviving permission components. Delete `tool-kind-to-agent-tool-kind.ts` and its tests.

**Requirements:** R4, R5

**Dependencies:** Unit 3 (registry deleted, so component imports from registry are gone).

### Pre-deletion import map (exhaustive — locked after second-pass sweep)

The following out-of-scope consumers were confirmed by exhaustive `rg` sweep across the entire `packages/` tree (excluding intra-`tool-calls/` hits, which are fine). Deletions are adjusted accordingly. **This table is the single source of truth; no further expansion expected.**

| File / directory scheduled for deletion | Out-of-scope importer(s) | Resolution |
|------------------------------------------|--------------------------|------------|
| `tool-call-edit/logic/` | `packages/desktop/src/lib/acp/components/agent-panel/scene/desktop-agent-panel-scene.ts` imports `resolveToolCallEditDiffs` | Relocate to `packages/desktop/src/lib/acp/utils/tool-call-edit/logic/` before deletion; update import |
| `tool-call-edit/constants/` | `packages/desktop/src/lib/acp/utils/markdown-renderer.ts` imports `SUPPORTED_LANGUAGES`; `packages/desktop/src/lib/acp/components/file-panel/format/markdown.ts` imports `MARKDOWN_EXTENSIONS` | Relocate to `packages/desktop/src/lib/acp/utils/tool-call-edit/constants/` before deletion; update both imports |
| `tool-call-execute/logic/parse-tool-result.ts` | `packages/desktop/src/lib/acp/store/services/tool-result-normalizer.ts` imports `parseToolResultWithExitCode` | Retain this file; delete rest of `tool-call-execute/` |
| `tool-call-fetch/logic/parse-fetch-result.ts` | `packages/desktop/src/lib/acp/store/services/tool-result-normalizer.ts` imports `parseFetchResult` | Retain this file; delete rest of `tool-call-fetch/` |
| `tool-call-search/logic/parse-grep-output.ts` | `packages/desktop/src/lib/acp/store/services/tool-result-normalizer.ts` imports `parseSearchResult` | Retain this file; delete rest of `tool-call-search/` |
| `tool-call-search/types/search-result.ts` | `packages/desktop/src/lib/acp/types/normalized-tool-result.ts` imports `SearchResult` type | Retain this file |
| `tool-call-task/` | `activity-entry-projection.ts` imported `convertTaskChildren` — **drained in Unit 2** | Entire directory deletable after Unit 2 |
| `exit-plan-helpers.ts` | `packages/desktop/src/lib/acp/components/tool-calls/permission-visibility.ts` (a kept file) imports `shouldHidePermissionBarForExitPlan`; `packages/desktop/src/lib/acp/components/queue/queue-item.svelte` imports `getExitPlanDisplayPlan` | **Retain** this file (and its test); remove from delete list |
| `tool-call-web-search/logic/parse-web-search-result.ts` | `packages/desktop/src/lib/acp/store/services/tool-result-normalizer.ts` imports `parseWebSearchResult` | Retain this file; apply narrowed-deletion to `tool-call-web-search/` (delete bespoke UI only) |
| `tool-call-web-search/types/web-search-result.ts` | `packages/desktop/src/lib/acp/types/normalized-tool-result.ts` imports `WebSearchResult` type | Retain this file |
| `browser-tool-display.ts` | `packages/desktop/src/lib/acp/store/services/tool-result-normalizer.ts` imports `parseBrowserToolResult` | **Retain** this file; remove from delete list |

**Files:**

*Relocation (must happen BEFORE deleting `tool-call-edit/`):*
- Create directory: `packages/desktop/src/lib/acp/utils/tool-call-edit/`
- Move: `packages/desktop/src/lib/acp/components/tool-calls/tool-call-edit/logic/` → `packages/desktop/src/lib/acp/utils/tool-call-edit/logic/`
- Move: `packages/desktop/src/lib/acp/components/tool-calls/tool-call-edit/constants/` → `packages/desktop/src/lib/acp/utils/tool-call-edit/constants/`
- Update imports in:
  - `packages/desktop/src/lib/acp/components/agent-panel/scene/desktop-agent-panel-scene.ts`: update `resolveToolCallEditDiffs` import path from `../../tool-calls/tool-call-edit/logic/resolve-tool-call-edit-diffs.js` → `../../../utils/tool-call-edit/logic/resolve-tool-call-edit-diffs.js`
  - `packages/desktop/src/lib/acp/utils/markdown-renderer.ts`: update `SUPPORTED_LANGUAGES` import path from `../components/tool-calls/tool-call-edit/constants/index.js` → `./tool-call-edit/constants/index.js`
  - `packages/desktop/src/lib/acp/components/file-panel/format/markdown.ts`: update `MARKDOWN_EXTENSIONS` import path from `../../tool-calls/tool-call-edit/constants/markdown-extensions.js` → `../../../utils/tool-call-edit/constants/markdown-extensions.js`

*Delete (bespoke Svelte components and support files):*
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-browser.svelte`
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-create-plan.svelte`
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-delete.svelte`
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-edit.svelte`
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-edit/` *(entire directory — safe after relocation of `logic/` and `constants/` above)*
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-enter-plan-mode.svelte`
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-plan-mode/` *(entire directory)*
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-execute.svelte`
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-execute/` *(partial — see narrowed deletion below)*
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-exit-plan-mode.svelte`
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-fetch.svelte`
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-fetch/` *(partial — see narrowed deletion below)*
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-footer.svelte`
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-mini.svelte`
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-question.svelte`
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-read.svelte`
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-read-lints.svelte`
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-search.svelte`
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-search/` *(partial — see narrowed deletion below)*
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-skill.svelte`
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-skill/` *(entire directory)*
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-task.svelte`
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-task-output.svelte`
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-task/` *(entire directory — `activity-entry-projection.ts` consumer drained in Unit 2)*
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-think.svelte`
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-think/` *(entire directory)*
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-todo.svelte`
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-tool-search.svelte`
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-web-search.svelte`
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-web-search/` *(partial — see narrowed deletion below)*
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-content-modal.svelte`
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-result-display.ts`
  - `packages/desktop/src/lib/acp/components/tool-calls/todo-inline.svelte`
  - `packages/desktop/src/lib/acp/components/tool-calls/content/` *(entire directory)*
  - `packages/desktop/src/lib/acp/components/tool-calls/shared/` *(entire directory)*
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-kind-to-agent-tool-kind.ts`
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-kind-to-agent-tool-kind.test.ts`
  - `packages/desktop/src/lib/acp/components/tool-calls/__tests__/semantic-tool-rendering.test.ts`
  - `packages/desktop/src/lib/acp/components/tool-calls/__tests__/tool-call-browser.svelte.vitest.ts`
  - `packages/desktop/src/lib/acp/components/tool-calls/__tests__/tool-call-read.svelte.vitest.ts`
  - `packages/desktop/src/lib/acp/components/tool-calls/__tests__/tool-call-task.svelte.vitest.ts`
  - `packages/desktop/src/lib/acp/components/tool-calls/__tests__/tool-result-display.test.ts`
  - `packages/desktop/src/lib/acp/components/tool-calls/__tests__/fixtures/` *(entire directory)*

*Narrowed deletions (partial directory deletions — retain files with out-of-scope consumers):*
- `tool-call-execute/`: delete all files **except** `logic/parse-tool-result.ts`. The file `packages/desktop/src/lib/acp/store/services/tool-result-normalizer.ts` imports `parseToolResultWithExitCode` from it. Deleting it would break `bun run check`. Cleanup of this file is a follow-on task.
- `tool-call-fetch/`: delete all files **except** `logic/parse-fetch-result.ts`. `tool-result-normalizer.ts` imports `parseFetchResult` from it.
- `tool-call-search/`: delete all files **except** `logic/parse-grep-output.ts` (imported by `tool-result-normalizer.ts`) and `types/search-result.ts` (imported by `packages/desktop/src/lib/acp/types/normalized-tool-result.ts`).
- `tool-call-web-search/`: delete all files **except** `logic/parse-web-search-result.ts` (imported by `tool-result-normalizer.ts`) and `types/web-search-result.ts` (imported by `packages/desktop/src/lib/acp/types/normalized-tool-result.ts`). Delete bespoke UI: `tool-call-web-search.svelte` (flat file, listed above), plus any remaining files inside the directory that are not those two retained files. Cleanup of these orphaned files is a follow-on task.

*Files to **keep** (do not delete):*
  - `packages/desktop/src/lib/acp/components/tool-calls/pending-permission-card.svelte`
  - `packages/desktop/src/lib/acp/components/tool-calls/permission-action-bar.svelte`
  - `packages/desktop/src/lib/acp/components/tool-calls/permission-bar.svelte`
  - `packages/desktop/src/lib/acp/components/tool-calls/permission-display.ts`
  - `packages/desktop/src/lib/acp/components/tool-calls/permission-visibility.ts`
  - `packages/desktop/src/lib/acp/components/tool-calls/__tests__/permission-display.test.ts`
  - `packages/desktop/src/lib/acp/components/tool-calls/__tests__/permission-visibility.test.ts`
  - `packages/desktop/src/lib/acp/components/tool-calls/index.ts` *(modified)*
  - `packages/desktop/src/lib/acp/components/tool-calls/exit-plan-helpers.ts` *(live consumers: `permission-visibility.ts` imports `shouldHidePermissionBarForExitPlan`; `queue/queue-item.svelte` imports `getExitPlanDisplayPlan`)*
  - `packages/desktop/src/lib/acp/components/tool-calls/__tests__/exit-plan-helpers.test.ts` *(retained with its module)*
  - `packages/desktop/src/lib/acp/components/tool-calls/browser-tool-display.ts` *(live consumer: `tool-result-normalizer.ts` imports `parseBrowserToolResult`)*
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-execute/logic/parse-tool-result.ts` *(live consumer in tool-result-normalizer.ts)*
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-execute/logic/__tests__/parse-tool-result.test.ts` *(retained with its module)*
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-fetch/logic/parse-fetch-result.ts` *(live consumer in tool-result-normalizer.ts)*
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-fetch/logic/__tests__/parse-fetch-result.test.ts` *(retained with its module)*
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-search/logic/parse-grep-output.ts` *(live consumer in tool-result-normalizer.ts)*
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-search/logic/__tests__/parse-grep-output.test.ts` *(retained with its module)*
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-search/types/search-result.ts` *(live consumer in normalized-tool-result.ts)*
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-web-search/logic/parse-web-search-result.ts` *(live consumer: `tool-result-normalizer.ts` imports `parseWebSearchResult`)*
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-web-search/logic/__tests__/parse-web-search-result.test.ts` *(retained with its module)*
  - `packages/desktop/src/lib/acp/components/tool-calls/tool-call-web-search/types/web-search-result.ts` *(live consumer: `normalized-tool-result.ts` imports `WebSearchResult` type)*
  - `packages/desktop/src/lib/acp/utils/tool-call-edit/logic/` *(relocated from tool-call-edit/logic/)*
  - `packages/desktop/src/lib/acp/utils/tool-call-edit/constants/` *(relocated from tool-call-edit/constants/)*

*Modify:*
- `packages/desktop/src/lib/acp/components/tool-calls/index.ts` — replace entire file content with only the permission-component exports. All bespoke component exports are removed.

**Approach:**
- **Step 0 (relocation — do first):** Move `tool-call-edit/logic/` and `tool-call-edit/constants/` to `packages/desktop/src/lib/acp/utils/tool-call-edit/`. Update the 3 import sites listed in Files. Run `bun run check` to confirm no dangling references before proceeding.
- **Step 1 (batch deletions):** Delete files in batches by subdirectory to keep `bun run check` tractable. Suggested order: `tool-call-edit/` (now safe after Step 0), then `tool-call-execute/` (partial), `tool-call-fetch/` (partial), `tool-call-search/` (partial), `tool-call-skill/`, `tool-call-task/`, `tool-call-think/`, `tool-call-web-search/` (partial), then flat files.
- For partial-directory deletions (`tool-call-execute/`, `tool-call-fetch/`, `tool-call-search/`): delete all files except those listed in the "retain" list in Files. Check with `bun run check` after each to catch any missed imports.
- After each batch, run `bun run check` to catch any non-obvious import chains before accumulating more deletions.
- After all deletions, rewrite `tool-calls/index.ts` to only export the five surviving permission components and their types.
- Verify `components/index.ts` still correctly re-exports from `tool-calls/index.ts` — since it uses `export * from "./tool-calls/index.js"`, no change needed there.
- Run `bun test` after all deletions to confirm the full test suite passes.

**Test scenarios:**
- Test expectation: none — this is mass file deletion. Verification is by type-check and test run.

**Verification:**
- `bun run check` passes from `packages/desktop`.
- `bun test` passes from `packages/desktop`.
- `ls packages/desktop/src/lib/acp/components/tool-calls/` shows only: `index.ts`, `exit-plan-helpers.ts`, `browser-tool-display.ts`, `pending-permission-card.svelte`, `permission-action-bar.svelte`, `permission-bar.svelte`, `permission-display.ts`, `permission-visibility.ts`, `__tests__/` (with only permission tests + `exit-plan-helpers.test.ts`), plus the partial remnants of `tool-call-execute/`, `tool-call-fetch/`, `tool-call-search/`, `tool-call-web-search/` (the retained logic/types files).
- `ls packages/desktop/src/lib/acp/utils/tool-call-edit/` shows `logic/` and `constants/` directories (relocated).
- `grep -r "ToolCallRouter\|tool-definition-registry\|tool-call-router" packages/desktop/src --include="*.ts" --include="*.svelte"` returns 0 matches.
- `rg "from .*tool-calls/tool-call-edit" packages/desktop/src` returns 0 matches (all edit references now point to `utils/tool-call-edit/`).

## System-Wide Impact

- **Interaction graph:** `session-view.svelte` → `virtual-session-list.svelte` — the only call chain affected in Unit 1. No other render paths touch the router.
- **Export surface:** `packages/desktop/src/lib/acp/components/index.ts` re-exports `* from "./tool-calls/index.js"`. After Unit 4, that barrel only surfaces the permission components. Any external code that imported a bespoke component by name through this barrel (e.g., `ToolCallEdit`) would break — confirmed by grep that no such external consumers exist.
- **Dead code after Unit 4:** `use-plan-inline.svelte.ts` (in `hooks/`) will become dead code after Unit 4 deletes its only callers (`tool-call-create-plan.svelte`, `tool-call-exit-plan-mode.svelte`). Its removal is a separate follow-on task. `question-selection-store.svelte.ts` (in `store/`) is NOT dead after this plan — it has live consumers outside the bespoke components (`main-app-view.svelte`, `kanban-view.svelte`, `queue-item.svelte`, `store/index.ts`) and must not be deleted here.
- **Retained logic files in `tool-call-execute/`, `tool-call-fetch/`, `tool-call-search/`:** Three logic/type files survive Unit 4 because `tool-result-normalizer.ts` and `normalized-tool-result.ts` import from them. These are now orphaned in their respective directories (the parent Svelte component is gone). Cleanup — relocating them to `packages/desktop/src/lib/acp/utils/` or collocating them with their only consumer — is a follow-on task.
- **Unchanged invariants:** permission components and their external consumers are completely unaffected. The `@acepe/ui` `AgentPanelConversationEntry` contract is unmodified. The canonical scene mapper (`desktop-agent-panel-scene.ts`) is used read-only by Units 1 and 2.

## Alternative Approaches Considered

- **Keep tool-definition-registry.ts as a pure data mapper (strip components, keep data functions):** This would avoid migrating `activity-entry-projection.ts` and `convert-task-children.ts`. Rejected — it leaves the file alive in a degraded state, the bespoke component imports become dead, and the registry concept continues to diverge from the scene mapper. The full migration to `mapToolCallToSceneEntry` is cleaner.
- **Port `enter_plan_mode` / `exit_plan_mode` interactive rendering into `@acepe/ui` before retiring the router:** These components have deep Tauri-store dependencies (`usePlanInline`, `getPanelStore`, permission store). Extracting them requires a non-trivial desktop/ui split. The ops view renders them rarely and does not need the approval interactivity. Deferred to a future task if needed.

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Bespoke component has a non-obvious transitive import not found by grep | Low | Build break | Run `bun run check` after each deletion batch in Unit 4 |
| `tool-call-edit/` relocation introduces a relative-path mistake in one of the 3 updated import sites | Low | Build break | Run `bun run check` immediately after Step 0 (relocation) before any file deletions |
| Additional files in `tool-call-execute/`, `tool-call-fetch/`, `tool-call-search/`, `tool-call-web-search/` are imported by out-of-scope consumers beyond those identified in the pre-deletion map | Mitigated (exhaustive second-pass sweep completed) | Build break | Pre-deletion import map is now locked after exhaustive grep; run `bun run check` after each partial-directory deletion as a final safeguard |
| `activity-entry-projection.ts` compact display produces subtly different output after migration | Low | Activity strip visual regression | Compare compact entry output for a few representative ToolKinds before and after; the projection logic is identical to the registry's `compactToolEntry` |
| `mapToolCallToSceneEntry` called with a non-tool_call entry accidentally | Impossible (callers already have `entry.type === "tool_call"` guard) | N/A | N/A |
| `question` ToolKind loses interactivity in the ops view | Certain | Minor: question ops view becomes display-only | Accepted; documented in parity gap table and Display Contracts |
| In-progress tools in ops view show as `"done"` (P1-B) | Certain | Minor: ops view status accuracy reduced | Accepted; documented in parity gap table |
| Parent-entry extraction changes child-status behavior for COMPLETED parent tasks | Certain (intentional) | Children of completed parents now receive `parentCompleted=true` instead of `false` (the prior code had no `parentCompleted` concept). This is the correct new behavior. | No mitigation needed — intentional behavioral improvement; noted here for reviewer awareness |

## Sources & References

- **Prior refactor:** `docs/plans/2026-05-01-002-refactor-agent-panel-single-render-path-plan.md`
- Scene mapper: `packages/desktop/src/lib/acp/components/agent-panel/scene/desktop-agent-panel-scene.ts`
- Canonical renderer: `packages/ui/src/components/agent-panel/agent-panel-conversation-entry.svelte`
- Router (to be deleted): `packages/desktop/src/lib/acp/components/tool-calls/tool-call-router.svelte`
- Registry (to be deleted): `packages/desktop/src/lib/acp/components/tool-calls/tool-definition-registry.ts`
- Consumer under migration: `packages/desktop/src/lib/acp/components/virtual-session-list.svelte`
