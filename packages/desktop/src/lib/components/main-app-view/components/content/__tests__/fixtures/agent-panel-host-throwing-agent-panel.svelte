<script lang="ts">
	interface Props {
		onClose?: () => void;
	}

	let { onClose }: Props = $props();

	let shouldCrash = $state(false);
	const crash = $derived.by(() => {
		if (shouldCrash) {
			throw new Error("agent panel render failed");
		}
		return "stable";
	});
</script>

<button
	type="button"
	data-testid="trigger-close-crash"
	onclick={() => {
		onClose?.();
		shouldCrash = true;
	}}
>
	{crash}
</button>
