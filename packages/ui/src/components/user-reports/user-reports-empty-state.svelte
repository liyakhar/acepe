<script lang="ts">
	interface Props {
		title?: string;
		description?: string;
		actionLabel?: string;
		onAction?: () => void;
	}

	let {
		title = 'No issues found',
		description = 'Be the first to report something',
		actionLabel,
		onAction
	}: Props = $props();
</script>

<div class="flex flex-col items-center justify-center min-h-full py-16 gap-2">
	<p class="text-[11px] font-mono text-muted-foreground/40">{title}</p>
	<p class="text-[10px] font-mono text-muted-foreground/25">{description}</p>
	{#if actionLabel && onAction}
		<button
			type="button"
			class="mt-2 h-6 px-3 text-[10px] font-mono font-medium text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 rounded transition-colors cursor-pointer"
			onclick={onAction}
		>
			{actionLabel}
		</button>
	{/if}
</div>
