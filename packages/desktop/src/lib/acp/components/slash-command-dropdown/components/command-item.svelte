<script lang="ts">
import IconTerminal from "@tabler/icons-svelte/icons/terminal";

import type { AvailableCommand } from "../../../types/available-command.js";

interface Props {
	command: AvailableCommand;
	isSelected: boolean;
	itemRef: HTMLDivElement | undefined;
	onSelect: (command: AvailableCommand) => void;
	onHover: () => void;
}

let { command, isSelected, itemRef = $bindable(), onSelect, onHover }: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	bind:this={itemRef}
	class="flex items-center gap-2 min-w-0 px-3 py-2 cursor-pointer {isSelected
		? 'bg-accent text-accent-foreground'
		: 'hover:bg-accent/50'}"
	title={command.description}
	onclick={() => onSelect(command)}
	onmouseenter={onHover}
>
	<IconTerminal
		class="h-3.5 w-3.5 shrink-0 {isSelected
			? 'text-accent-foreground'
			: 'text-muted-foreground'}"
	/>
	<span class="min-w-0 truncate font-mono text-[11px] leading-none">/{command.name}</span>
</div>
