<script lang="ts">
	import Robot from "phosphor-svelte/lib/Robot";

	import { Colors } from "../../lib/colors.js";
	import { TextShimmer } from "../text-shimmer/index.js";

	interface Props {
		summary: string;
		isStreaming?: boolean;
	}

	let { summary, isStreaming = false }: Props = $props();
</script>

<div
	class="flex min-w-0 items-center gap-1.5 overflow-hidden rounded-sm border border-border/60 bg-accent/30 px-1.5 py-1"
	data-testid="queue-subagent-card"
>
	<div
		class="w-0.5 shrink-0 self-stretch rounded-full"
		style="background-color: {Colors.purple}"
		data-testid="queue-subagent-accent"
	></div>
	<Robot size={10} weight="fill" style="color: {Colors.purple}" class="shrink-0" />
	<div class="min-w-0 flex-1 font-mono text-[10px] text-muted-foreground">
		{#if isStreaming}
			<TextShimmer class="block truncate">{summary}</TextShimmer>
		{:else}
			<span class="block truncate">{summary}</span>
		{/if}
	</div>
</div>