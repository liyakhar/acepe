import type { StreamingAnimationMode } from "$lib/acp/types/streaming-animation-mode.js";

import { createSmoothStreamingReveal } from "./create-smooth-streaming-reveal.svelte.js";
import { createStreamingReveal } from "./create-streaming-reveal.svelte.js";
import type { RevealMode } from "./streaming-reveal-engine.js";

export interface StreamingRevealController {
	setState(sourceText: string, isStreaming: boolean, options?: { seedFromSource?: boolean }): void;
	reset(): void;
	destroy(): void;
	readonly displayedText: string;
	readonly mode: RevealMode;
	readonly isRevealActive: boolean;
}

function createInstantStreamingReveal(): StreamingRevealController {
	let displayedText = $state("");
	let mode = $state<RevealMode>("idle");
	let isRevealActive = $state(false);

	function setState(
		sourceText: string,
		isStreaming: boolean,
		_options?: { seedFromSource?: boolean }
	): void {
		displayedText = sourceText;
		isRevealActive = false;

		if (sourceText.length === 0) {
			mode = "idle";
			return;
		}

		mode = isStreaming ? "streaming" : "complete";
	}

	function reset(): void {
		displayedText = "";
		mode = "idle";
		isRevealActive = false;
	}

	function destroy(): void {}

	return {
		setState,
		reset,
		destroy,
		get displayedText() {
			return displayedText;
		},
		get mode() {
			return mode;
		},
		get isRevealActive() {
			return isRevealActive;
		},
	};
}

export function createStreamingRevealController(
	mode: StreamingAnimationMode
): StreamingRevealController {
	if (mode === "classic") {
		return createStreamingReveal();
	}

	if (mode === "smooth") {
		return createSmoothStreamingReveal();
	}

	return createInstantStreamingReveal();
}
