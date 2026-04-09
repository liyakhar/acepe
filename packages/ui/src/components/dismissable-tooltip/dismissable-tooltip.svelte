<script lang="ts">
	import type { Snippet } from "svelte";

	interface DismissableTooltipProps {
		dismissed: boolean;
		onDismiss: () => void;
		title: string;
		description: string;
		side?: "top" | "right" | "bottom" | "left";
		sideOffset?: number;
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		triggerClass?: string;
		children: Snippet;
	}

	let {
		dismissed,
		onDismiss,
		title,
		description,
		side = "right",
		sideOffset = 8,
		open = false,
		onOpenChange,
		triggerClass = "inline-flex",
		children,
	}: DismissableTooltipProps = $props();

	const CLOSE_DELAY_MS = 120;
	const contentSideClassMap = {
		top: "bottom-full left-1/2 -translate-x-1/2",
		right: "left-full top-1/2 -translate-y-1/2",
		bottom: "top-full left-1/2 -translate-x-1/2",
		left: "right-full top-1/2 -translate-y-1/2",
	} as const;

	let closeTimer: ReturnType<typeof setTimeout> | null = null;

	function cancelClose(): void {
		if (closeTimer === null) {
			return;
		}

		clearTimeout(closeTimer);
		closeTimer = null;
	}

	function requestOpen(): void {
		cancelClose();
		onOpenChange?.(true);
	}

	function requestClose(): void {
		cancelClose();
		closeTimer = setTimeout(() => {
			closeTimer = null;
			onOpenChange?.(false);
		}, CLOSE_DELAY_MS);
	}

	function handleDismiss(): void {
		cancelClose();
		onDismiss();
		onOpenChange?.(false);
	}

	function handleContentKeydown(event: KeyboardEvent): void {
		if (event.key !== "Escape") {
			return;
		}

		cancelClose();
		onOpenChange?.(false);
	}

	function getContentOffsetStyle(nextSide: "top" | "right" | "bottom" | "left"): string {
		if (nextSide === "top") {
			return `margin-bottom: ${sideOffset}px;`;
		}

		if (nextSide === "right") {
			return `margin-left: ${sideOffset}px;`;
		}

		if (nextSide === "bottom") {
			return `margin-top: ${sideOffset}px;`;
		}

		return `margin-right: ${sideOffset}px;`;
	}
</script>

{#if dismissed}
	{@render children()}
{:else}
	<span class={`relative ${triggerClass}`} onpointerleave={requestClose}>
		<span onpointermove={requestOpen}>
			{@render children()}
		</span>

		{#if open}
			<div
				class={`bg-popover border-border text-foreground absolute z-[var(--overlay-z)] max-w-52 rounded-md border px-2.5 py-2 text-xs shadow-md ${contentSideClassMap[side]}`}
				style={getContentOffsetStyle(side)}
				onpointerenter={cancelClose}
				onpointerleave={requestClose}
				onkeydown={handleContentKeydown}
			>
				<p class="mb-1 font-semibold">{title}</p>
				<p class="text-muted-foreground mb-2">{description}</p>
				<div class="flex justify-end">
					<button
						type="button"
						class="text-foreground hover:text-foreground/80 cursor-pointer text-xs font-medium"
						aria-label="Dismiss this tip"
						onclick={handleDismiss}
					>
						Got it
					</button>
				</div>
			</div>
		{/if}
	</span>
{/if}
