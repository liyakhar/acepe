<script lang="ts">
	import Robot from "phosphor-svelte/lib/Robot";

	import { Colors } from "../../lib/colors.js";
	import AgentToolRow from "../agent-panel/agent-tool-row.svelte";
	import ToolTally from "../agent-panel/tool-tally.svelte";
	import type { AgentToolEntry, AgentToolKind, AgentToolStatus } from "../agent-panel/types.js";
	import { TextShimmer } from "../text-shimmer/index.js";

	interface Props {
		summary: string;
		isStreaming?: boolean;
		latestTool?: {
			id: string;
			kind?: AgentToolKind;
			title: string;
			filePath?: string;
			status: AgentToolStatus;
		} | null;
		toolCalls?: AgentToolEntry[];
	}

	let { summary, isStreaming = false, latestTool = null, toolCalls = [] }: Props = $props();

	const fallbackToolCalls = $derived.by((): AgentToolEntry[] => {
		if (toolCalls.length > 0) {
			return toolCalls;
		}

		if (!latestTool) {
			return [];
		}

		return [
			{
				id: latestTool.id,
				type: "tool_call",
				kind: latestTool.kind,
				title: latestTool.title,
				filePath: latestTool.filePath,
				status: latestTool.status,
			},
		];
	});
</script>

<div
	class="flex w-full min-w-0 flex-col overflow-hidden rounded-sm border border-border/60 bg-accent/30"
	data-testid="queue-subagent-card"
>
	<div class="flex min-w-0 items-center gap-2 overflow-hidden px-2 py-1.5 text-xs">
		<Robot size={12} weight="fill" style="color: {Colors.purple}" class="shrink-0" />
		<div class="min-w-0 flex-1 overflow-hidden font-mono text-[11px] text-muted-foreground">
			<span class="block truncate font-medium" title={summary}>
				{#if isStreaming}
					<TextShimmer>{summary}</TextShimmer>
				{:else}
					{summary}
				{/if}
			</span>
		</div>
	</div>

	{#if toolCalls.length > 0}
		<div class="border-t border-border/60">
			{#each toolCalls as toolCall (toolCall.id)}
				<div class="py-1.5 border-b border-border/40 last:border-b-0">
					<AgentToolRow
						title={toolCall.title}
						subtitle={toolCall.subtitle}
						filePath={toolCall.filePath}
						status={toolCall.status}
						kind={toolCall.kind}
						iconBasePath="/svgs/icons"
					/>
				</div>
			{/each}
		</div>
	{:else if latestTool}
		<div class="border-t border-border py-1.5">
			<AgentToolRow
				title={latestTool.title}
				filePath={latestTool.filePath}
				status={latestTool.status}
				kind={latestTool.kind}
				iconBasePath="/svgs/icons"
			/>
		</div>
	{/if}

	{#if fallbackToolCalls.length > 0}
		<div class="border-t border-border/60 px-2 py-1">
			<ToolTally toolCalls={fallbackToolCalls} inline={true} />
		</div>
	{/if}
</div>