<script lang="ts">
import {
	buildVoiceDownloadSegments,
	formatVoiceDownloadPercent,
} from "./voice-download-progress.js";

interface Props {
	ariaLabel: string;
	compact: boolean;
	label: string;
	percent: number;
	segmentCount: number;
	showPercent?: boolean;
}

const { ariaLabel, compact, label, percent, segmentCount, showPercent = true }: Props = $props();

const percentLabel = $derived(formatVoiceDownloadPercent(percent));
const segments = $derived(buildVoiceDownloadSegments(percent, segmentCount));
</script>

<div class:compact class="voice-download-progress flex items-center gap-2 min-w-0" aria-label={ariaLabel}>
	{#if label.length > 0}
		<span class="truncate text-[11px] font-medium text-foreground/70">{label}</span>
	{/if}

	<div class="voice-download-segments" aria-hidden="true">
		{#each segments as isFilled, index (index)}
			<div class:filled={isFilled} class="voice-download-segment voice-download-segment-vertical"></div>
		{/each}
	</div>

	{#if showPercent}
		<span class="voice-download-percent shrink-0 tabular-nums text-muted-foreground/55">
			{percentLabel}
		</span>
	{/if}
</div>

<style>
	.voice-download-progress {
		min-width: 0;
	}

	.voice-download-segments {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 3px;
		gap: 2px;
		align-items: end;
		height: 8px;
	}

	.voice-download-segment {
		width: 3px;
		height: 8px;
		border-radius: 999px;
		background: color-mix(in oklab, var(--foreground) 10%, transparent);
		transition: background-color 180ms ease-out, opacity 180ms ease-out, transform 180ms ease-out;
		opacity: 0.55;
		transform-origin: bottom center;
	}

	.voice-download-segment.filled {
		background: #f9c396;
		opacity: 1;
	}

	.voice-download-segment-vertical:not(.filled) {
		height: 5px;
	}

	.voice-download-percent {
		font-size: 10px;
		letter-spacing: 0.02em;
	}

	.compact {
		gap: 1.5px;
	}

	.compact .voice-download-segments {
		grid-auto-columns: 2px;
		gap: 1.5px;
		height: 7px;
	}

	.compact .voice-download-segment {
		width: 2px;
		height: 7px;
	}

	.compact .voice-download-segment-vertical:not(.filled) {
		height: 4px;
	}

	.compact .voice-download-percent {
		font-size: 9px;
	}
</style>
