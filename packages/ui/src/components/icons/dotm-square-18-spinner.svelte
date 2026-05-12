<!--
  Ported from @dotmatrix/dotm-square-18 "Sound Bars"
  (https://dotmatrix.zzzzshawn.cloud/r/dotm-square-18.json).
-->
<script lang="ts">
	import { cn } from "../../lib/utils";

	interface Props {
		class?: string;
		style?: string;
		role?: string;
		"aria-label"?: string;
		size?: number;
		color?: string;
		animated?: boolean;
		speed?: number;
	}

	let {
		class: className = "",
		style: styleAttr = "",
		role = undefined,
		"aria-label": ariaLabel = undefined,
		size = undefined,
		color = "currentColor",
		animated = true,
		speed = 1.35,
	}: Props = $props();

	const MATRIX_SIZE = 5;
	const CYCLE_MS_BASE = 1750;

	const isDecorative = $derived(role === undefined && ariaLabel === undefined);
	const safeSpeed = $derived(speed > 0 ? speed : 1);
	const cycleMs = $derived(`${CYCLE_MS_BASE / safeSpeed}ms`);
	const rootSizeStyle = $derived(size === undefined ? "" : `width:${size}px;height:${size}px;`);
	const rootStyle = $derived(`${rootSizeStyle}color:${color};${styleAttr}`.trim());
	const gridStyle = `grid-template-columns:repeat(${MATRIX_SIZE},minmax(0,1fr));grid-template-rows:repeat(${MATRIX_SIZE},minmax(0,1fr))`;

	function dotStyle(row: number, col: number): string {
		const base = `--dmx-cycle:${cycleMs}`;
		if (!animated) {
			const opacity = row >= MATRIX_SIZE - 2 ? 0.94 : 0.08;
			return `${base};opacity:${opacity}`;
		}

		const delay = -(col * 0.18 * (CYCLE_MS_BASE / safeSpeed));
		return `${base};--dmx-delay:${delay}ms`;
	}
</script>

<div
	class={cn("acepe-dotm-square-root", className)}
	style={rootStyle}
	aria-hidden={isDecorative ? "true" : undefined}
	{role}
	aria-label={ariaLabel}
>
	<div class="acepe-dotm-square-grid" style={gridStyle}>
		{#each Array.from({ length: MATRIX_SIZE * MATRIX_SIZE }, (_, index) => index) as index (index)}
			{@const row = Math.floor(index / MATRIX_SIZE)}
			{@const col = index % MATRIX_SIZE}
			<span
				aria-hidden="true"
				class={cn(
					"acepe-dotm-square-dot",
					`acepe-dotm-square-row-${row}`,
					animated && "acepe-dotm-square-animated"
				)}
				style={dotStyle(row, col)}
			></span>
		{/each}
	</div>
</div>

<style>
	.acepe-dotm-square-root {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		vertical-align: middle;
		width: 1em;
		height: 1em;
	}

	.acepe-dotm-square-grid {
		display: grid;
		width: 100%;
		height: 100%;
		gap: 10%;
	}

	.acepe-dotm-square-dot {
		border-radius: 999px;
		display: block;
		background: currentColor;
		opacity: 0.08;
		width: 100%;
		height: 100%;
	}

	.acepe-dotm-square-dot.acepe-dotm-square-animated {
		animation-duration: var(--dmx-cycle);
		animation-delay: var(--dmx-delay);
		animation-iteration-count: infinite;
		animation-timing-function: steps(1, end);
	}

	.acepe-dotm-square-row-4.acepe-dotm-square-animated {
		animation-name: acepe-dotm-square18-row-4;
	}

	.acepe-dotm-square-row-3.acepe-dotm-square-animated {
		animation-name: acepe-dotm-square18-row-3;
	}

	.acepe-dotm-square-row-2.acepe-dotm-square-animated {
		animation-name: acepe-dotm-square18-row-2;
	}

	.acepe-dotm-square-row-1.acepe-dotm-square-animated {
		animation-name: acepe-dotm-square18-row-1;
	}

	.acepe-dotm-square-row-0.acepe-dotm-square-animated {
		animation-name: acepe-dotm-square18-row-0;
	}

	@keyframes acepe-dotm-square18-row-4 {
		0%,
		100% {
			opacity: 0.94;
		}
	}

	@keyframes acepe-dotm-square18-row-3 {
		0%,
		100% {
			opacity: 0.08;
		}
		10%,
		80% {
			opacity: 0.94;
		}
		20% {
			opacity: 1;
		}
	}

	@keyframes acepe-dotm-square18-row-2 {
		0%,
		100% {
			opacity: 0.08;
		}
		20%,
		66% {
			opacity: 0.94;
		}
		32% {
			opacity: 1;
		}
	}

	@keyframes acepe-dotm-square18-row-1 {
		0%,
		100% {
			opacity: 0.08;
		}
		30%,
		52% {
			opacity: 0.94;
		}
		40% {
			opacity: 1;
		}
	}

	@keyframes acepe-dotm-square18-row-0 {
		0%,
		100% {
			opacity: 0.08;
		}
		22% {
			opacity: 0.08;
		}
		38%,
		46% {
			opacity: 0.94;
		}
		42% {
			opacity: 1;
		}
		62% {
			opacity: 0.08;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.acepe-dotm-square-dot.acepe-dotm-square-animated {
			animation: none;
			opacity: 0.34;
		}
	}
</style>
