<script lang="ts">
import type { AgentPanelSceneEntryModel } from "@acepe/ui/agent-panel";

let {
	isWaitingForResponse = false,
	sceneEntries = [],
} = $props<{
	isWaitingForResponse?: boolean;
	sessionId?: string | null;
	sceneEntries?: readonly AgentPanelSceneEntryModel[];
}>();
</script>

<div
	data-testid="virtualized-entry-list-stub"
	data-waiting={isWaitingForResponse ? "true" : "false"}
>
	{#each sceneEntries as entry (entry.id)}
		{#if entry.type === "assistant"}
			<div data-testid="virtualized-entry-list-stub-assistant">{entry.markdown}</div>
		{/if}
	{/each}
</div>
