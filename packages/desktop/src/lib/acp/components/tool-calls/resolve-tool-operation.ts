import type { PermissionRequest } from "../../types/permission.js";
import type { ToolCall } from "../../types/tool-call.js";
import type { ToolKind } from "../../types/tool-kind.js";
import { mergePermissionArgs } from "../../utils/merge-permission-args.js";

export type ToolRouteKey = ToolKind | "read_lints";

export interface ResolvedToolOperation {
	resolvedKind: ToolKind;
	routeKey: ToolRouteKey;
	toolCall: ToolCall;
	shouldShowInlinePermissionActionBar: boolean;
}

export function resolveToolOperation(
	toolCall: ToolCall,
	pendingPermission: PermissionRequest | null | undefined
): ResolvedToolOperation {
	const resolvedKind = toolCall.kind ?? "other";
	const routeKey = resolveToolRouteKey(toolCall, resolvedKind);

	return {
		resolvedKind,
		routeKey,
		toolCall: createResolvedToolCall(toolCall, pendingPermission),
		shouldShowInlinePermissionActionBar:
			pendingPermission !== null &&
			pendingPermission !== undefined &&
			resolvedKind !== "exit_plan_mode",
	};
}

export function resolveToolRouteKey(toolCall: ToolCall, resolvedKind: ToolKind): ToolRouteKey {
	if (
		resolvedKind === "read" &&
		(toolCall.title?.trim() === "Read Lints" || toolCall.name === "read_lints")
	) {
		return "read_lints";
	}

	return resolvedKind;
}

function createResolvedToolCall(
	toolCall: ToolCall,
	pendingPermission: PermissionRequest | null | undefined
): ToolCall {
	return {
		id: toolCall.id,
		name: toolCall.name,
		arguments: mergePermissionArgs(toolCall.arguments, pendingPermission),
		status: toolCall.status,
		result: toolCall.result,
		kind: toolCall.kind,
		title: toolCall.title,
		locations: toolCall.locations,
		skillMeta: toolCall.skillMeta,
		normalizedQuestions: toolCall.normalizedQuestions,
		normalizedTodos: toolCall.normalizedTodos,
		parentToolUseId: toolCall.parentToolUseId,
		taskChildren: toolCall.taskChildren,
		questionAnswer: toolCall.questionAnswer,
		awaitingPlanApproval: toolCall.awaitingPlanApproval,
		planApprovalRequestId: toolCall.planApprovalRequestId,
		startedAtMs: toolCall.startedAtMs,
		completedAtMs: toolCall.completedAtMs,
	};
}
