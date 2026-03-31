<script lang="ts">
import * as Tooltip from "$lib/components/ui/tooltip/index.js";

interface AutonomousToggleButtonProps {
	readonly active: boolean;
	readonly disabled: boolean;
	readonly busy: boolean;
	readonly tooltip: string;
	readonly onToggle: () => Promise<void>;
}

let { active, disabled, busy, tooltip, onToggle }: AutonomousToggleButtonProps = $props();

function handleClick(): void {
	if (disabled || busy) {
		return;
	}

	void onToggle();
}
</script>

<Tooltip.Root>
	<Tooltip.Trigger>
		{#snippet child({ props: triggerProps })}
			<button
				{...triggerProps}
				type="button"
				onclick={handleClick}
				aria-pressed={active}
				aria-disabled={disabled || busy}
				class="flex h-7 items-center px-2.5 text-[11px] font-medium transition-colors rounded-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
				class:bg-destructive={active}
				class:text-destructive-foreground={active}
				class:hover:bg-destructive/90={active && !busy}
				class:text-muted-foreground={!active && !disabled}
				class:hover:bg-accent/50={!active && !disabled && !busy}
				class:hover:text-foreground={!active && !disabled && !busy}
				class:text-muted-foreground/60={disabled && !active}
				class:cursor-default={disabled || busy}
				class:opacity-70={busy && !active}
			>
				Autonomous
			</button>
		{/snippet}
	</Tooltip.Trigger>
	<Tooltip.Content>
		<span>{tooltip}</span>
	</Tooltip.Content>
</Tooltip.Root>