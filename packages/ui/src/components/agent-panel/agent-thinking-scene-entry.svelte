<script lang="ts">
	import { getPlanningPlaceholderLabel } from "./planning-label.js";
	import { resolveThinkingDurationMs, shouldRunThinkingTimer } from "./thinking-duration.js";
	import ToolHeaderLeading from "./tool-header-leading.svelte";

	interface Props {
		durationMs?: number | null;
		startedAtMs?: number | null;
		label?: string | null;
	}

	let { durationMs = null, startedAtMs = null, label = null }: Props = $props();
	let nowMs = $state(Date.now());

	const currentDurationMs = $derived(
		resolveThinkingDurationMs({
			startedAtMs,
			durationMs,
			nowMs,
		})
	);
	const displayLabel = $derived(label ?? getPlanningPlaceholderLabel(currentDurationMs));

	$effect(() => {
		if (!shouldRunThinkingTimer(startedAtMs)) {
			return;
		}

		nowMs = Date.now();
		const intervalId = window.setInterval(() => {
			nowMs = Date.now();
		}, 1000);

		return () => {
			window.clearInterval(intervalId);
		};
	});
</script>

<div class="flex items-center gap-2 py-1 text-sm text-muted-foreground">
	<ToolHeaderLeading kind="think" status="running">
		{displayLabel}
	</ToolHeaderLeading>
</div>
