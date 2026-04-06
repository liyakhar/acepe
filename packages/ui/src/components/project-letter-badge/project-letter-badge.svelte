<script lang="ts">
	import HashStraight from "phosphor-svelte/lib/HashStraight";
	import { Colors } from "../../lib/colors.js";

	interface Props {
		/** The project name to extract the first letter from */
		name: string;
		/** The color for the letter */
		color: string;
		/** Badge size in px (default 20) */
		size?: number;
		/** Override font size in px (default: size * 0.55) */
		fontSize?: number;
		/** Per-project sequence ID. When provided, renders #N to the left of the badge. */
		sequenceId?: number | null;
		/** Additional CSS classes */
		class?: string;
	}

	let {
		name,
		color,
		size = 20,
		fontSize: fontSizeProp,
		sequenceId,
		class: className = "",
	}: Props = $props();

	const letter = $derived(name.charAt(0).toUpperCase());
	const hasSequenceId = $derived(sequenceId != null);
	const displayColor = $derived(color === Colors.green ? "var(--success)" : color);

	const fontSize = $derived(fontSizeProp ?? size * 0.715);
	const radius = $derived(size * 0.25);
</script>

<span class="inline-flex items-center {className}" style="gap: 0px;">
	<div
		class="flex items-center justify-center shrink-0"
		style="
			background-color: {displayColor};
			width: {size}px;
			height: {size}px;
			border-radius: {hasSequenceId ? `${radius}px 0 0 ${radius}px` : `${radius}px`};
		"
	>
		<span
			class="font-black leading-none"
			style="font-size: {fontSize}px; color: color-mix(in srgb, {displayColor} 30%, black);"
		>
			{letter}
		</span>
	</div>
	{#if hasSequenceId}
		<span
			class="inline-flex items-center justify-center shrink-0"
			style="
				height: {size}px;
				padding: 0 {size * 0.25}px;
				border-left: 1px solid color-mix(in srgb, {displayColor} 30%, black);
				border-radius: 0 {radius}px {radius}px 0;
				background-color: {displayColor};
			"
		>
			<span
				class="inline-flex items-center leading-none"
				style="gap: 0px; color: color-mix(in srgb, {displayColor} 30%, black);"
			>
				<HashStraight size={size * 0.6} weight="bold" />
				<span
					class="font-mono font-bold"
					style="font-size: {size * 0.6}px;"
				>{sequenceId}</span>
			</span>
		</span>
	{/if}
</span>
