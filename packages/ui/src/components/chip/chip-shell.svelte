<script lang="ts">
	import type { Snippet } from "svelte";

	import {
		buildChipShellClassName,
		type ChipShellDensity,
		type ChipShellSize,
	} from "./chip-shell.classes.js";

	interface Props {
		as?: "span" | "button" | "a";
		href?: string;
		target?: string;
		rel?: string;
		title?: string;
		ariaLabel?: string;
		role?: string;
		dataFilePath?: string;
		class?: string;
		density?: ChipShellDensity;
		size?: ChipShellSize;
		interactive?: boolean;
		selected?: boolean;
		onclick?: (e: MouseEvent) => void;
		children?: Snippet;
	}

	let {
		as = "span",
		href,
		target,
		rel,
		title,
		ariaLabel,
		role,
		dataFilePath,
		class: className = "",
		density = "badge",
		size = "default",
		interactive = false,
		selected = false,
		onclick,
		children,
	}: Props = $props();

	const isInteractive = $derived(interactive || as !== "span");
	const classNames = $derived(
		buildChipShellClassName({
			density,
			size,
			interactive: isInteractive,
			selected,
			className,
		}),
	);
</script>

{#if as === "a"}
	<a
		{href}
		{target}
		{rel}
		class={classNames}
		title={title}
		aria-label={ariaLabel}
		data-file-path={dataFilePath}
	>
		{@render children?.()}
	</a>
{:else if as === "button"}
	<button
		type="button"
		class={classNames}
		title={title}
		aria-label={ariaLabel}
		data-file-path={dataFilePath}
		onclick={onclick}
	>
		{@render children?.()}
	</button>
{:else}
	<span
		class={classNames}
		title={title}
		aria-label={ariaLabel}
		role={role}
		data-file-path={dataFilePath}
	>
		{@render children?.()}
	</span>
{/if}