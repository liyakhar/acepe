---
date: 2026-03-31
topic: kanban-view
---

# Kanban View for the Attention Queue

## Problem Frame

Acepe currently shows active sessions in a compact attention queue (sidebar/overlay) grouped into sections by state: answer needed, working, finished, and error. This works well for quick triage but does not give the user a spatial, persistent overview of all active work. Power users running multiple agents across projects need a bird's-eye layout where sessions are organized as cards in columns by state, like a kanban board.

The kanban view is a new view mode alongside single, project, and multi. It reuses the existing queue section model and QueueItem data rather than inventing a parallel classification system.

## Requirements

**View Mode Integration**

- R1. Kanban must be a new value in the existing `ViewMode` union, selectable from the same layout menu that offers single, project, and multi.
- R2. When kanban is active, the attention queue sidebar/overlay must hide — the board replaces it as the primary attention surface.
- R3. Switching away from kanban to another view mode must preserve the user's panel and focus state exactly as it was before entering kanban.
- R4. Kanban must be persisted and restored via the same workspace state mechanism used by the other view modes.

**Board Layout**

- R5. The board must render as horizontal columns, one per queue section, in the standard section order: Answer Needed → Planning → Working → Finished → Error.
- R6. Each column must show its section label, color accent, and a count of items in that column.
- R7. Empty columns must remain visible with an empty-state indicator so the spatial layout stays stable.
- R8. Columns must scroll vertically when their items exceed the visible height.
- R9. The board must be horizontally scrollable or responsive so it works when the window is narrow enough that not all four columns fit.

**Planning Column**

- R25. The queue classifier must split the current "working" section so that sessions in plan mode (`currentModeId === "plan"`) with active streaming or thinking activity are classified as `"planning"` instead of `"working"`.
- R26. The planning column must use the existing `SectionedFeedSectionId` value `"planning"` with its purple color and hammer icon — this value already exists in the UI type system but is not currently produced by the classifier.
- R27. Sessions in plan mode that are idle, paused, or have pending input must still classify into their normal priority section (answer_needed, finished, etc.) — only actively streaming/thinking plan-mode sessions move to the planning column.

**Card Design**

- R10. Cards must replicate the `AttentionQueueSubagentCard` visual style at a larger scale: `rounded-sm` corners, `border border-border/60`, `bg-accent/30` background, and a violet (`Colors.purple` / `#9858FF`) left accent strip (`w-0.5 self-stretch rounded-full`).
- R10a. Each card must show a Phosphor `Robot` icon in violet (`weight="fill"`, `Colors.purple`) at the top-left of the card header, matching the subagent card's icon treatment but sized up for the larger card context.
- R10b. Streaming activity text on cards must use `TextShimmer` for the shimmer effect, matching the subagent card's streaming state.
- R11. The card body must show: session title (or fallback), agent badge, project name with color badge, and a time-ago label.
- R12. Cards in the "working" and "planning" columns must show the current activity indicator: the active tool kind or a streaming/thinking shimmer via `TextShimmer`.
- R13. Cards in the "finished" column must show the diff pill (insertions/deletions) when the session has code changes.
- R14. Cards in the "error" column must show the connection error text.
- R15. Cards must show todo progress when the session has active todos.
- R16. Cards must show the current mode (e.g. plan/build) as a small badge.

**Embedded Queue Item for Pending Input**

- R28. When a card has pending input (permission or question), the card must embed the compact queue-item UI from the existing attention queue at the bottom of the card — the same inline approval/answer controls the user already knows.
- R29. The embedded queue-item footer must support inline permission approval (approve/reject) and inline question answering directly on the card, without leaving the board.
- R30. The embedded footer must reuse or wrap the existing `PermissionFeedItem` and question UI components rather than rebuilding approval controls from scratch.

**Card Interaction**

- R17. Clicking a card (outside the embedded queue-item footer) must navigate to that session's panel in single view mode, exactly like clicking a queue item does today.
- R18. Inline approval and question answering must work directly inside the embedded queue-item footer without navigating away from the board.
- R19. Cards must not support drag-and-drop between columns — session state is derived from runtime activity, not user-assigned status.

**Data Source**

- R20. The board must consume the same `QueueItem[]` and `groupIntoSections()` pipeline that the existing attention queue uses.
- R21. The board must update in real time as sessions change state, with cards moving between columns automatically.
- R22. The board must show all sessions that currently appear in the attention queue — no additional filtering or session discovery logic.

**UI Component Location**

- R23. The board layout component and card component must live in `packages/ui` as presentational components, consistent with the existing attention queue components there.
- R24. The desktop-specific wiring (store access, navigation callbacks, permission handlers) must live in `packages/desktop`.

## Success Criteria

- A user can switch to the kanban view from the layout menu and see all active sessions organized by state in a horizontal board.
- Sessions move between columns automatically as their state changes — including moving from "working" to "planning" when a session enters plan mode.
- Clicking a card jumps to that session in single view.
- Permissions can be approved and questions answered inline from the embedded queue-item footer on any card that has pending input.
- The board replaces the attention queue overlay when active, so the user is not seeing the same information twice.
- Switching back to another view mode restores prior panel/focus state.

## Scope Boundaries

- No drag-and-drop between columns — session state is derived, not manually assigned.
- No custom column ordering, hiding, or filtering in this version.
- No inline chat or message composition from the board — only triage actions (approve, reject, navigate).
- No additional queue sections beyond the five defined here (answer_needed, planning, working, finished, error).
- No WIP limits or column policies.

## Key Decisions

- **View mode, not a panel**: Kanban is a layout mode like single/project/multi, not a new panel type. It replaces the content area.
- **Same data source**: Reuses `groupIntoSections()` and `QueueItem` — no parallel classification system.
- **No drag-and-drop**: Session state is runtime-derived. Manual column assignment would fight the automation model.
- **Embedded queue-item UI**: Cards embed the existing compact queue-item controls for permissions and questions rather than building separate kanban-specific approval UI.
- **Planning column via classifier change**: Plan-mode streaming sessions are split from "working" into "planning" using the already-defined `SectionedFeedSectionId` value.
- **Subagent card visual language**: Cards follow the compact bordered-card-with-accent-strip pattern established by `AttentionQueueSubagentCard`.
- **Hide queue overlay**: When kanban is active, the queue overlay would be redundant.

## Dependencies / Assumptions

- The `ViewMode` union and persistence path can accept a fourth value without breaking restore compatibility.
- The `groupIntoSections()` pipeline and `QueueItem` type are stable enough to build a view on top of.
- The `@acepe/ui` package can host a new board component alongside the existing `SectionedFeed`.

## Outstanding Questions

### Deferred to Planning

- [Affects R5][Technical] Whether columns should be fixed-width or flex equally, and how the layout degrades below ~900px.
- [Affects R28-R30][Technical] How the embedded queue-item footer wraps the existing `PermissionFeedItem` and question UI components — whether it instantiates them directly or uses a shared wrapper that adapts sizing for the card context.
- [Affects R25-R27][Technical] Whether the planning classification change should live in `classifyItem()` directly or as a post-classification split so the existing four-section consumers are not affected.
- [Affects R2][Technical] Whether the attention queue overlay should be fully unmounted in kanban mode or just visually hidden.
- [Affects R4][Technical] How workspace restore handles the kanban view mode when the saved state references it but the board has no focused panel.

## Next Steps

→ /ce:plan for structured implementation planning
