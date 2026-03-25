<script lang="ts">
interface Props {
	children?: import("svelte").Snippet;
	class?: string;
}

let { children, class: className = "" }: Props = $props();
</script>

<div data-testid="text-shimmer-stub" class={className}>
	{#if children}
		{@render children()}
	{/if}
</div>
