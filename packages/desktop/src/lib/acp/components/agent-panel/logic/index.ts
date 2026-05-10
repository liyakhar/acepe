/**
 * Agent Panel Business Logic
 *
 * Pure functions for agent panel operations.
 * All functions use neverthrow Result types for error handling.
 */

export { mapCanonicalTurnStateToHotTurnState } from "../../../store/canonical-turn-state-mapping";
export { copySessionToClipboard, copyTextToClipboard } from "./clipboard-manager";
export { derivePanelErrorInfo } from "./connection-ui";
export { createAutoScroll } from "./create-auto-scroll.svelte.js";
export { resolveEffectiveProjectPath } from "./effective-project-path";
export { calculateLoadingProgress, isLoadingComplete } from "./loading-animator";
export { loadSessionPlan } from "./plan-loader";
export {
	resolveOptimisticUserEntryForGraph,
	resolveVisibleEntryCount,
} from "./optimistic-user-entry.js";
export {
	applyAgentPanelDisplayMemory,
	applyAgentPanelDisplayModelToSceneEntries,
	buildAgentPanelBaseModel,
	createAgentPanelDisplayMemory,
	type AgentPanelBaseModel,
	type AgentPanelDisplayInput,
	type AgentPanelDisplayMemory,
	type AgentPanelDisplayModel,
	type AgentPanelDisplayResult,
	type AgentPanelDisplayRow,
} from "./agent-panel-display-model.js";
export { backfillSceneEntryTimestamps } from "./backfill-scene-entry-timestamps.js";
export {
	deriveCanonicalAgentPanelSessionState,
	deriveEffectiveCanonicalTurnPresentation,
	mapCanonicalSessionToPanelStatus,
	mapSessionStatusToUI,
} from "./session-status-mapper";
export { resolveVisibleSessionEntries } from "./visible-session-entries";
export {
	createPendingWorktreeCloseConfirmationState,
	createResolvedWorktreeCloseConfirmationState,
	shouldConfirmWorktreeClose,
} from "./worktree-close-confirmation";
export { removeWorktreeAndMarkSessionWorktreeDeleted } from "./worktree-removal";
export {
	createWorktreeCreationState,
	createWorktreeSetupMatchContext,
	matchesWorktreeSetupContext,
	reduceWorktreeSetupEvent,
} from "./worktree-setup-events";
