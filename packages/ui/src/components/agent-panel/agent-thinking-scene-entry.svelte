<script lang="ts">
	import AgentToolRow from "./agent-tool-row.svelte";
	import { getPlanningPlaceholderLabel } from "./planning-label.js";
	import { resolveThinkingDurationMs, shouldRunThinkingTimer } from "./thinking-duration.js";

	interface Props {
		durationMs?: number | null;
		startedAtMs?: number | null;
	}

	let { durationMs = null, startedAtMs = null }: Props = $props();
	let nowMs = $state(Date.now());

	const currentDurationMs = $derived(
		resolveThinkingDurationMs({
			startedAtMs,
			durationMs,
			nowMs,
		})
	);

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

<AgentToolRow title={getPlanningPlaceholderLabel(currentDurationMs)} status="running" padded={false} />
