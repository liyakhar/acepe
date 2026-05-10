<script lang="ts">
	interface Props {
		title?: string;
		summary?: string;
	}

	let { title = "", summary = "" }: Props = $props();
</script>

<div data-testid="agent-error-card">
	<div>{title}</div>
	<div>{summary}</div>
</div>
