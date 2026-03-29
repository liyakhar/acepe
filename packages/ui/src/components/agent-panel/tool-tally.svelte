<script lang="ts">
	import { Colors } from "../../lib/colors.js";
	import type { AgentToolEntry } from "./types.js";

	interface Props {
		toolCalls: AgentToolEntry[];
	}

	let { toolCalls }: Props = $props();

	const bars = $derived.by(() => {
		return toolCalls.map((toolCall) => {
			if (toolCall.status === "error") {
				return { color: Colors.red, label: `${toolCall.title}: failed` };
			}

			if (toolCall.status === "pending" || toolCall.status === "running") {
				return { color: Colors.purple, label: `${toolCall.title}: running` };
			}

			return { color: Colors.green, label: `${toolCall.title}: done` };
		});
	});

	const footerLabel = $derived(
		`${toolCalls.length} tool ${toolCalls.length === 1 ? "call" : "calls"}`
	);
</script>

{#if toolCalls.length > 0}
	<div
		class="flex h-1.5 w-full items-stretch gap-px border-t border-border bg-border/60"
		role="img"
		aria-label={footerLabel}
	>
		{#each bars as bar, index (toolCalls[index]?.id ?? `${bar.label}-${index}`)}
			<div
				class="min-w-[3px] flex-1"
				style="background-color: {bar.color}"
				title={bar.label}
			></div>
		{/each}
	</div>
{/if}
