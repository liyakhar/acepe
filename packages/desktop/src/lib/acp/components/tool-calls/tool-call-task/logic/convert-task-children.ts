import type { AgentToolEntry } from "@acepe/ui/agent-panel";
import type { TurnState } from "../../../../store/types.js";
import type { ToolCall } from "../../../../types/tool-call.js";
import { resolveFullToolEntry } from "../../tool-definition-registry.js";

/**
 * Convert taskChildren (ToolCall[]) into AnyAgentEntry[] for the AgentToolTask UI.
 */
export function convertTaskChildren(
	children: ToolCall[] | null | undefined,
	turnState?: TurnState,
	parentCompleted: boolean = false
): AgentToolEntry[] {
	if (!children || children.length === 0) return [];
	return children.map((child) =>
		resolveFullToolEntry({
			toolCall: child,
			turnState,
			parentCompleted,
		})
	);
}
