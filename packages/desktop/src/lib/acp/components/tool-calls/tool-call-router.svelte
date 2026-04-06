<script lang="ts">
	import { useSessionContext } from "../../hooks/use-session-context.js";
	import { getPermissionStore } from "../../store/permission-store.svelte.js";
	import type { TurnState } from "../../store/types.js";
	import type { PermissionRequest } from "../../types/permission.js";
	import type { ToolCall } from "../../types/tool-call.js";
	import { formatToolElapsedLabel, getToolStatus } from "../../utils/tool-state-utils.js";
	import { resolveToolOperation } from "./resolve-tool-operation.js";
	import { getToolDefinition } from "./tool-definition-registry.js";

interface Props {
	toolCall: ToolCall;
	turnState?: TurnState;
	/**
	 * Project path for file operations (e.g., reading full file content in Edit modal).
	 */
	projectPath?: string;
}

let { toolCall, turnState = "idle", projectPath }: Props = $props();
let nowMs = $state(Date.now());

const permissionStore = getPermissionStore();
const sessionContext = useSessionContext();
const pendingPermission = $derived(
	permissionStore.getForToolCall(sessionContext?.sessionId, toolCall.id)
);
const resolvedOperation = $derived(resolveToolOperation(toolCall, pendingPermission));
const toolDefinition = $derived(
	getToolDefinition(resolvedOperation.toolCall, resolvedOperation.resolvedKind)
);
const ToolComponent = $derived(toolDefinition.component);

const toolStatus = $derived(getToolStatus(toolCall, turnState));
const elapsedLabel = $derived(
	formatToolElapsedLabel({
		startedAtMs: toolCall.startedAtMs,
		completedAtMs: toolCall.completedAtMs,
		isRunning: toolStatus.isPending,
		nowMs,
	})
);

$effect(() => {
	if (!toolStatus.isPending || toolCall.startedAtMs === undefined) {
		return;
	}

	nowMs = Date.now();
	const intervalId = window.setInterval(() => {
		nowMs = Date.now();
	}, 1000);

	return () => {
		window.clearInterval(intervalId);
	};
});
</script>

<div class="flex min-w-0 flex-col gap-2">
	<ToolComponent
		toolCall={resolvedOperation.toolCall}
		{turnState}
		{projectPath}
		{elapsedLabel}
		pendingPermission={pendingPermission ?? null}
	/>
</div>
