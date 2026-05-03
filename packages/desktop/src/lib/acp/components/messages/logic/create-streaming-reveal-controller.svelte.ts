import type { StreamingAnimationMode } from "$lib/acp/types/streaming-animation-mode.js";

export type RevealMode =
	| "idle"
	| "streaming"
	| "paused-awaiting-more"
	| "completion-catchup"
	| "complete";

export const CSS_DRAIN_TIMEOUT_MS = 200;
export const REVEAL_TICK_MS = 50;
const MIN_STREAMING_ADVANCE_CHARS = 4;
const MAX_STREAMING_ADVANCE_CHARS = 18;
const MIN_COMPLETION_ADVANCE_CHARS = 48;
const MAX_COMPLETION_ADVANCE_CHARS = 512;
const STREAMING_BACKLOG_DIVISOR = 10;
const COMPLETION_BACKLOG_DIVISOR = 2;

type MotionMediaQuery = Pick<
	MediaQueryList,
	"matches" | "addEventListener" | "removeEventListener"
>;

export interface StreamingRevealController {
	setState(
		sourceText: string,
		isStreaming: boolean,
		options?: {
			seedFromSource?: boolean;
			seedDisplayedText?: string;
			paceCompletionWithStreaming?: boolean;
		}
	): void;
	setMode(mode: StreamingAnimationMode): void;
	reset(): void;
	destroy(): void;
	readonly displayedText: string;
	readonly mode: RevealMode;
	readonly isRevealActive: boolean;
}

function getMotionMediaQuery(): MotionMediaQuery | null {
	if (
		typeof globalThis.window !== "undefined" &&
		typeof globalThis.window.matchMedia === "function"
	) {
		return globalThis.window.matchMedia("(prefers-reduced-motion: reduce)");
	}

	if (typeof globalThis.matchMedia === "function") {
		return globalThis.matchMedia("(prefers-reduced-motion: reduce)");
	}

	return null;
}

export function createStreamingRevealController(
	_initialMode: StreamingAnimationMode
): StreamingRevealController {
	let displayedText = $state("");
	let targetText = "";
	let mode = $state<RevealMode>("idle");
	let isRevealActive = $state(false);
	let isStreamingSource = false;
	let useStreamingPaceForCatchup = false;
	let prefersReducedMotion = false;
	let holdPacedRevealActive = false;
	let drainTimeoutId: ReturnType<typeof setTimeout> | null = null;
	let revealTimeoutId: ReturnType<typeof setTimeout> | null = null;
	const motionMediaQuery = getMotionMediaQuery();

	function clearDrainTimeout(): void {
		if (drainTimeoutId !== null) {
			clearTimeout(drainTimeoutId);
			drainTimeoutId = null;
		}
	}

	function clearRevealTimeout(): void {
		if (revealTimeoutId !== null) {
			clearTimeout(revealTimeoutId);
			revealTimeoutId = null;
		}
	}

	function syncRevealActivity(): void {
		isRevealActive =
			isStreamingSource ||
			revealTimeoutId !== null ||
			drainTimeoutId !== null ||
			holdPacedRevealActive;
	}

	function syncMode(): void {
		if (displayedText.length === 0 && targetText.length === 0 && !isStreamingSource) {
			mode = "idle";
			return;
		}

		if (isStreamingSource) {
			mode =
				targetText.length > displayedText.length || targetText.length === 0
					? "streaming"
					: "paused-awaiting-more";
			return;
		}

		mode = displayedText.length < targetText.length ? "completion-catchup" : "complete";
	}

	function canDrain(): boolean {
		return displayedText.length > 0 && !prefersReducedMotion;
	}

	function cancelDrain(): void {
		clearDrainTimeout();
		syncRevealActivity();
	}

	function scheduleDrain(): void {
		clearDrainTimeout();
		syncRevealActivity();
		drainTimeoutId = setTimeout(() => {
			drainTimeoutId = null;
			holdPacedRevealActive = false;
			syncMode();
			syncRevealActivity();
		}, CSS_DRAIN_TIMEOUT_MS);
		syncRevealActivity();
	}

	function canPaceReveal(): boolean {
		return targetText.length > displayedText.length && !prefersReducedMotion;
	}

	function computeAdvanceLength(backlog: number): number {
		if (isStreamingSource || useStreamingPaceForCatchup) {
			return Math.min(
				MAX_STREAMING_ADVANCE_CHARS,
				Math.max(MIN_STREAMING_ADVANCE_CHARS, Math.ceil(backlog / STREAMING_BACKLOG_DIVISOR))
			);
		}

		return Math.min(
			MAX_COMPLETION_ADVANCE_CHARS,
			Math.max(MIN_COMPLETION_ADVANCE_CHARS, Math.ceil(backlog / COMPLETION_BACKLOG_DIVISOR))
		);
	}

	function scheduleRevealTick(): void {
		if (revealTimeoutId !== null || !canPaceReveal()) {
			syncRevealActivity();
			return;
		}

		revealTimeoutId = setTimeout(() => {
			revealTimeoutId = null;

			if (!canPaceReveal()) {
				syncMode();
				if (!isStreamingSource && displayedText === targetText && canDrain()) {
					scheduleDrain();
				} else {
					syncRevealActivity();
				}
				return;
			}

			const backlog = targetText.length - displayedText.length;
			const nextLength = Math.min(
				targetText.length,
				displayedText.length + computeAdvanceLength(backlog)
			);
			displayedText = targetText.slice(0, nextLength);
			if (!isStreamingSource && displayedText === targetText) {
				useStreamingPaceForCatchup = false;
			}
			syncMode();

			if (canPaceReveal()) {
				scheduleRevealTick();
				return;
			}

			if (!isStreamingSource && displayedText === targetText && canDrain()) {
				scheduleDrain();
				return;
			}

			syncRevealActivity();
		}, REVEAL_TICK_MS);
		syncRevealActivity();
	}

	function setState(
		sourceText: string,
		isStreaming: boolean,
		options?: {
			seedFromSource?: boolean;
			seedDisplayedText?: string;
			paceCompletionWithStreaming?: boolean;
		}
	): void {
		targetText = sourceText;
		isStreamingSource = isStreaming;
		clearDrainTimeout();
		if (isStreaming) {
			useStreamingPaceForCatchup = true;
		}
		if (
			options?.paceCompletionWithStreaming === true &&
			!isStreaming &&
			sourceText.length > displayedText.length
		) {
			useStreamingPaceForCatchup = true;
		} else if (!isStreaming) {
			useStreamingPaceForCatchup = false;
		}

		const shouldSeedFromSource = options?.seedFromSource === true;
		const shouldHoldExplicitPacedReveal =
			options?.paceCompletionWithStreaming === true &&
			!prefersReducedMotion &&
			!shouldSeedFromSource;
		if (shouldHoldExplicitPacedReveal) {
			holdPacedRevealActive = true;
		} else if (!isStreaming) {
			holdPacedRevealActive = false;
		}
		const seedDisplayedText = options?.seedDisplayedText;
		if (
			!shouldSeedFromSource &&
			seedDisplayedText !== undefined &&
			seedDisplayedText.length > displayedText.length &&
			sourceText.startsWith(seedDisplayedText)
		) {
			displayedText = seedDisplayedText;
		}
		if (
			displayedText.length > 0 &&
			displayedText.trim().length === 0 &&
			sourceText.trim().length > 0 &&
			!sourceText.startsWith(displayedText)
		) {
			displayedText = "";
		}
		const hasNonPrefixRewrite = displayedText.length > 0 && !sourceText.startsWith(displayedText);
		const shouldResetPacedReplacement =
			shouldHoldExplicitPacedReveal && sourceText.length > 0 && hasNonPrefixRewrite;
		if (shouldResetPacedReplacement) {
			clearRevealTimeout();
			displayedText = "";
		}
		const shouldSnapToSource =
			shouldSeedFromSource ||
			prefersReducedMotion ||
			(!shouldHoldExplicitPacedReveal &&
				(sourceText.length < displayedText.length || hasNonPrefixRewrite));

		if (shouldSnapToSource) {
			clearRevealTimeout();
			displayedText = sourceText;
			useStreamingPaceForCatchup = false;
			holdPacedRevealActive = false;
		}

		if (shouldHoldExplicitPacedReveal && sourceText.length === 0) {
			clearRevealTimeout();
			targetText = displayedText;
			useStreamingPaceForCatchup = false;
			syncMode();
			syncRevealActivity();
			return;
		}

		syncMode();

		if (sourceText.length === 0 && !isStreaming) {
			clearRevealTimeout();
			displayedText = "";
			targetText = "";
			useStreamingPaceForCatchup = false;
			holdPacedRevealActive = false;
			syncMode();
			syncRevealActivity();
			return;
		}

		if (canPaceReveal()) {
			scheduleRevealTick();
			return;
		}

		clearRevealTimeout();

		if (!isStreaming && displayedText === targetText && canDrain()) {
			scheduleDrain();
			return;
		}

		syncRevealActivity();
	}

	function setMode(_nextMode: StreamingAnimationMode): void {}

	function reset(): void {
		clearDrainTimeout();
		clearRevealTimeout();
		displayedText = "";
		targetText = "";
		isStreamingSource = false;
		useStreamingPaceForCatchup = false;
		holdPacedRevealActive = false;
		mode = "idle";
		isRevealActive = false;
	}

	function handleReducedMotionChange(event: MediaQueryListEvent): void {
		prefersReducedMotion = event.matches;
		if (prefersReducedMotion) {
			clearRevealTimeout();
			clearDrainTimeout();
			displayedText = targetText;
			useStreamingPaceForCatchup = false;
			holdPacedRevealActive = false;
			syncMode();
			syncRevealActivity();
			return;
		}

		if (targetText.length > displayedText.length) {
			scheduleRevealTick();
			return;
		}

		if (drainTimeoutId !== null && !canDrain()) {
			cancelDrain();
		}
	}

	if (motionMediaQuery !== null) {
		prefersReducedMotion = motionMediaQuery.matches;
		motionMediaQuery.addEventListener("change", handleReducedMotionChange);
	}

	function destroy(): void {
		clearDrainTimeout();
		clearRevealTimeout();
		if (motionMediaQuery !== null) {
			motionMediaQuery.removeEventListener("change", handleReducedMotionChange);
		}
	}

	return {
		setState,
		setMode,
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
