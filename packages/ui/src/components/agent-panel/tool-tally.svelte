<script lang="ts">
	import type { AgentToolEntry } from "./types.js";

	/** Voice-download progress bar color */
	const BAR_COLOR = "#f9c396";
	const BAR_COLOR_DIM = "color-mix(in oklab, var(--foreground) 10%, transparent)";

	interface Props {
		toolCalls: AgentToolEntry[];
	}

	let { toolCalls }: Props = $props();

	const bars = $derived.by(() => {
		return toolCalls.map((toolCall) => {
			const filled = toolCall.status === "done" || toolCall.status === "error";
			return {
				filled,
				label: `${toolCall.title}: ${toolCall.status}`,
			};
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
				style="background-color: {bar.filled ? BAR_COLOR : BAR_COLOR_DIM}; opacity: {bar.filled ? 1 : 0.55}"
				title={bar.label}
			></div>
		{/each}
	</div>
{/if}
