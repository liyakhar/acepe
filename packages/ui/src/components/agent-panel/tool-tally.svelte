<script lang="ts">
	import type { AgentToolEntry } from "./types.js";

	const BAR_COLOR = "#f9c396";

	interface Props {
		toolCalls: AgentToolEntry[];
	}

	let { toolCalls }: Props = $props();

	const bars = $derived.by(() => {
		return toolCalls.map((toolCall) => {
			return { label: `${toolCall.title}: ${toolCall.status}` };
		});
	});

	const footerLabel = $derived(
		`${toolCalls.length} tool ${toolCalls.length === 1 ? "call" : "calls"}`
	);
</script>

{#if toolCalls.length > 0}
	<div
		class="flex items-center gap-[2px] border-t border-border px-2 py-1.5"
		role="img"
		aria-label={footerLabel}
	>
		{#each bars as bar, index (toolCalls[index]?.id ?? `${bar.label}-${index}`)}
			<div
				class="h-2 w-[3px] rounded-full"
				style="background-color: {BAR_COLOR}"
				title={bar.label}
			></div>
		{/each}
	</div>
{/if}
