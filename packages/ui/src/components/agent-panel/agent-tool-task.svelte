<script lang="ts">
	import CaretRight from "phosphor-svelte/lib/CaretRight";
	import Robot from "phosphor-svelte/lib/Robot";
	import { Colors } from "../../lib/colors.js";
	import { TextShimmer } from "../text-shimmer/index.js";
	import type { AgentToolStatus, AnyAgentEntry, AgentToolEntry } from "./types.js";
	import AgentToolCard from "./agent-tool-card.svelte";
	import ToolTally from "./tool-tally.svelte";

	interface Props {
		description: string | null;
		prompt?: string | null;
		resultText?: string | null;
		children?: AnyAgentEntry[];
		status?: AgentToolStatus;
		durationLabel?: string;
		iconBasePath?: string;
		runningFallback?: string;
		doneFallback?: string;
		resultLabel?: string;
	}

	let {
		description,
		prompt,
		resultText,
		children = [],
		status = "done",
		durationLabel,
		iconBasePath = "",
		runningFallback = "Running task…",
		doneFallback = "Task",
		resultLabel = "Result",
	}: Props = $props();

	let isPromptCollapsed = $state(true);
	let isResultCollapsed = $state(true);

	const isPending = $derived(status === "pending" || status === "running");
	const isDone = $derived(status === "done");

	const taskChildren = $derived(children);

	/** Child tool entries only (tool_call type) for the Tool calls section. */
	const toolCallChildren = $derived(
		taskChildren.filter((e): e is AgentToolEntry => e.type === "tool_call"),
	);

	const hasPrompt = $derived(Boolean(prompt));
	const hasResult = $derived(isDone && Boolean(resultText));
	const hasChildren = $derived(toolCallChildren.length > 0);

	const hasBorder = $derived(hasPrompt || hasResult);
</script>

<AgentToolCard>
	<!-- Header: fixed h-7 height -->
	<div
		class="flex h-7 items-center justify-between gap-1 px-2 text-xs"
		class:border-b={hasBorder}
		class:border-border={hasBorder}
	>
		<div class="flex min-w-0 flex-1 justify-start items-center gap-2">
			<Robot size={12} weight="fill" style="color: {Colors.purple}" class="shrink-0" />
			<span class="font-mono text-[11px]">
				{#if isPending}
					<TextShimmer class="font-medium text-muted-foreground">
						{description ?? runningFallback}
					</TextShimmer>
				{:else}
					<span class="font-medium text-muted-foreground">{description ?? doneFallback}</span>
				{/if}
			</span>
		</div>
		{#if durationLabel}
			<span class="shrink-0 font-mono text-[10px] text-muted-foreground/70">{durationLabel}</span>
		{/if}
	</div>

	<!-- Prompt section (collapsible) -->
	{#if hasPrompt && prompt}
		<button
			type="button"
			onclick={() => { isPromptCollapsed = !isPromptCollapsed; }}
			class="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted/30 transition-colors border-none bg-transparent cursor-pointer"
		>
			<CaretRight
				size={10}
				weight="bold"
				class="shrink-0 transition-transform duration-150 {isPromptCollapsed ? '' : 'rotate-90'}"
			/>
			<span class="truncate flex-1 text-left text-muted-foreground/80">
				{prompt.slice(0, 80)}{prompt.length > 80 ? "..." : ""}
			</span>
		</button>

		{#if !isPromptCollapsed}
			<div class="px-3 pb-2">
				<div class="text-xs text-muted-foreground whitespace-pre-wrap break-words leading-relaxed">
					{prompt}
				</div>
			</div>
		{/if}
	{/if}

	<!-- Result section (collapsible) -->
	{#if hasResult && resultText}
		<div class="border-t border-border">
			<button
				type="button"
				onclick={() => { isResultCollapsed = !isResultCollapsed; }}
				class="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/30 transition-colors border-none bg-transparent cursor-pointer"
			>
				<CaretRight
					size={10}
					weight="bold"
					class="shrink-0 transition-transform duration-150 {isResultCollapsed ? '' : 'rotate-90'}"
				/>
				<span class="font-medium">{resultLabel}</span>
				{#if isResultCollapsed}
					<span class="text-muted-foreground/60 truncate flex-1 text-left">
						{resultText.slice(0, 100)}{resultText.length > 100 ? "..." : ""}
					</span>
				{/if}
			</button>

			{#if !isResultCollapsed}
				<div class="px-3 pb-3">
					<div class="text-xs bg-muted/30 rounded-md p-3 whitespace-pre-wrap break-words leading-relaxed">
						{resultText}
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Tool calls footer: one embedded bar per child tool call -->
	{#if hasChildren}
		<ToolTally toolCalls={toolCallChildren} />
	{/if}

</AgentToolCard>
