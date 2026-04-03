import type { AgentToolEntry, AgentToolKind, AgentToolStatus } from "@acepe/ui/agent-panel";
import {
	getToolKindFilePath,
	getToolKindSubtitle,
	getToolKindTitle,
} from "../../../../registry/tool-kind-ui-registry.js";
import type { TurnState } from "../../../../store/types.js";
import type { ToolCall } from "../../../../types/tool-call.js";
import type { ToolKind } from "../../../../types/tool-kind.js";
import { toAgentToolKind } from "../../tool-kind-to-agent-tool-kind.js";

/** Map ToolCallStatus to AgentToolStatus. */
function mapStatus(
	child: ToolCall,
	turnState: TurnState | undefined,
	parentCompleted: boolean
): AgentToolStatus {
	if (child.status === "failed") {
		return "error";
	}

	if (child.status === "completed") {
		return "done";
	}

	const hasResult = child.result !== null && child.result !== undefined;
	if (hasResult) {
		return "done";
	}

	if (parentCompleted) {
		return "done";
	}

	if (child.status === "in_progress" && turnState === "streaming") {
		return "running";
	}

	// Turn ended (completed / interrupted / idle / error) while tool was still
	// in_progress → treat as done so the shimmer stops.
	if (child.status === "in_progress" && turnState !== undefined && turnState !== "streaming") {
		return "done";
	}

	return "pending";
}

/** Convert a ToolCall child into an AgentToolEntry for display in the task card. */
function convertChild(
	child: ToolCall,
	turnState: TurnState | undefined,
	parentCompleted: boolean
): AgentToolEntry {
	const kind = child.kind ?? "other";

	return {
		id: child.id,
		type: "tool_call",
		kind: toAgentToolKind(kind),
		title: child.title ?? getToolKindTitle(kind, child) ?? child.name,
		subtitle: getToolKindSubtitle(kind, child) || undefined,
		filePath: getToolKindFilePath(kind, child) ?? undefined,
		status: mapStatus(child, turnState, parentCompleted),
	};
}

/**
 * Convert taskChildren (ToolCall[]) into AnyAgentEntry[] for the AgentToolTask UI.
 */
export function convertTaskChildren(
	children: ToolCall[] | null | undefined,
	turnState?: TurnState,
	parentCompleted: boolean = false
): AgentToolEntry[] {
	if (!children || children.length === 0) return [];
	return children.map((child) => convertChild(child, turnState, parentCompleted));
}
