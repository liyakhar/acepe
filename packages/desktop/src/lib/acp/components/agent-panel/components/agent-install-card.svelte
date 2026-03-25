<script lang="ts">
import { Spinner } from "$lib/components/ui/spinner/index.js";
import CircularProgress from "$lib/components/ui/circular-progress/circular-progress.svelte";
import * as m from "$lib/paraglide/messages.js";
import AnimatedChevron from "../../animated-chevron.svelte";
import AgentIcon from "../../agent-icon.svelte";

interface Props {
	agentId: string;
	agentName: string;
	stage: string;
	progress: number;
}

let { agentId, agentName, stage, progress }: Props = $props();

let isExpanded = $state(false);

</script>

<div class="w-full px-5 mb-2">
	<div
		role="button"
		tabindex="0"
		onclick={() => (isExpanded = !isExpanded)}
		onkeydown={(event: KeyboardEvent) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				isExpanded = !isExpanded;
			}
		}}
		class="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-accent hover:bg-accent/80 transition-colors cursor-pointer"
	>
		<div class="flex items-center gap-1.5 min-w-0 text-[0.6875rem]">
			<Spinner class="size-[13px]" />

			<AgentIcon {agentId} class="size-3 shrink-0" size={12} />

			<span class="font-medium text-foreground shrink-0">
				{m.agent_install_setting_up({ agentName })}
			</span>

			<span class="truncate text-muted-foreground">
				{stage}
			</span>
		</div>

		<div class="flex items-center gap-2 shrink-0">
			{#if progress > 0}
				<CircularProgress
					current={progress}
					total={1}
					size={12}
					strokeWidth={1.5}
					class="text-muted-foreground"
				/>
			{/if}
			<AnimatedChevron isOpen={isExpanded} class="size-3.5 text-muted-foreground" />
		</div>
	</div>

	{#if isExpanded}
		<div class="rounded-b-lg bg-accent/50 overflow-hidden">
			<div class="px-3 py-2">
				<pre class="font-mono text-[0.6875rem] leading-relaxed whitespace-pre-wrap break-words text-foreground/80">{stage}</pre>
			</div>
		</div>
	{/if}
</div>
