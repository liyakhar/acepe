<script lang="ts">
	interface Props {
		placeholder?: string;
		submitLabel?: string;
		autofocus?: boolean;
		onSubmit: (body: string) => Promise<void>;
		onCancel?: () => void;
	}

	let {
		placeholder = 'Write a comment...',
		submitLabel = 'comment',
		autofocus = false,
		onSubmit,
		onCancel
	}: Props = $props();

	let body = $state('');
	let submitting = $state(false);

	const canSubmit = $derived(body.trim().length > 0 && !submitting);

	async function handleSubmit() {
		if (!canSubmit) return;
		submitting = true;
		await onSubmit(body.trim())
			.then(() => {
				body = '';
			})
			.finally(() => {
				submitting = false;
			});
	}
</script>

<div class="flex flex-col gap-2">
	<textarea
		bind:value={body}
		{placeholder}
		rows={2}
		class="w-full resize-y rounded-md border border-border/30 bg-transparent px-3 py-2 text-[11px] font-mono text-foreground leading-relaxed placeholder:text-muted-foreground/25 focus:border-ring focus:ring-ring/50 focus:ring-[2px] outline-none transition-shadow"
		onkeydown={(e) => {
			if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSubmit();
		}}
	></textarea>
	<div class="flex items-center justify-end gap-2">
		{#if onCancel}
			<button
				type="button"
				class="h-6 px-2.5 text-[10px] font-mono text-muted-foreground/50 hover:text-foreground transition-colors cursor-pointer rounded hover:bg-accent/25"
				onclick={onCancel}
			>
				cancel
			</button>
		{/if}
		<button
			type="button"
			class="h-6 px-3 text-[10px] font-mono font-medium text-primary-foreground bg-primary hover:bg-primary/90 disabled:opacity-30 rounded transition-colors cursor-pointer disabled:cursor-not-allowed"
			disabled={!canSubmit}
			onclick={handleSubmit}
		>
			{submitting ? 'posting...' : submitLabel}
		</button>
	</div>
</div>
