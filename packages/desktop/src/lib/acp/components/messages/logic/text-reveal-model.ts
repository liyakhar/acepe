const BASE_CHARS_PER_SECOND = 180;
const ADAPTIVE_GAP_THRESHOLD = 200;
const MAX_ADAPTIVE_MULTIPLIER = 12;
const DEFAULT_FRAME_DURATION_MS = 1000 / 60;

export interface RevealProgress {
	totalChars: number;
	revealedChars: number;
	renderedChars: number;
	isStreaming: boolean;
	lastFrameTime: number | null;
}

export function createRevealProgress(totalChars: number): RevealProgress {
	const normalizedTotal = totalChars > 0 ? totalChars : 0;

	return {
		totalChars: normalizedTotal,
		revealedChars: normalizedTotal,
		renderedChars: normalizedTotal,
		isStreaming: false,
		lastFrameTime: null,
	};
}

function calculateCharsPerFrame(gap: number, elapsedMs: number): number {
	const safeElapsedMs = elapsedMs > 0 ? elapsedMs : DEFAULT_FRAME_DURATION_MS;
	const baseChars = Math.max(1, Math.round((BASE_CHARS_PER_SECOND * safeElapsedMs) / 1000));

	if (gap <= ADAPTIVE_GAP_THRESHOLD) {
		return baseChars;
	}

	const adaptiveMultiplier = Math.min(
		MAX_ADAPTIVE_MULTIPLIER,
		Math.max(2, Math.ceil(gap / ADAPTIVE_GAP_THRESHOLD)),
	);

	return baseChars * adaptiveMultiplier;
}

export function syncRevealProgress(progress: RevealProgress, totalChars: number): RevealProgress {
	const normalizedTotal = totalChars > 0 ? totalChars : 0;
	let revealedChars = progress.revealedChars > normalizedTotal ? normalizedTotal : progress.revealedChars;
	let renderedChars = progress.renderedChars > normalizedTotal ? normalizedTotal : progress.renderedChars;

	if (renderedChars > revealedChars) {
		renderedChars = revealedChars;
	}

	if (!progress.isStreaming) {
		revealedChars = normalizedTotal;
		renderedChars = normalizedTotal;
	}

	return {
		totalChars: normalizedTotal,
		revealedChars,
		renderedChars,
		isStreaming: progress.isStreaming,
		lastFrameTime: progress.lastFrameTime,
	};
}

export function updateStreamingState(
	progress: RevealProgress,
	nextIsStreaming: boolean,
): RevealProgress {
	if (!nextIsStreaming) {
		return {
			totalChars: progress.totalChars,
			revealedChars: progress.totalChars,
			renderedChars: progress.totalChars,
			isStreaming: false,
			lastFrameTime: null,
		};
	}

	return {
		totalChars: progress.totalChars,
		revealedChars: progress.revealedChars,
		renderedChars: progress.renderedChars,
		isStreaming: true,
		lastFrameTime: null,
	};
}

export function hasPendingReveal(progress: RevealProgress): boolean {
	return progress.isStreaming && progress.revealedChars < progress.totalChars;
}

export function clearRevealFrameTime(progress: RevealProgress): RevealProgress {
	return {
		totalChars: progress.totalChars,
		revealedChars: progress.revealedChars,
		renderedChars: progress.renderedChars,
		isStreaming: progress.isStreaming,
		lastFrameTime: null,
	};
}

export function advanceRevealProgress(progress: RevealProgress, frameTime: number): RevealProgress {
	if (!progress.isStreaming) {
		return {
			totalChars: progress.totalChars,
			revealedChars: progress.revealedChars,
			renderedChars: progress.renderedChars,
			isStreaming: false,
			lastFrameTime: null,
		};
	}

	if (progress.revealedChars >= progress.totalChars) {
		return {
			totalChars: progress.totalChars,
			revealedChars: progress.totalChars,
			renderedChars: progress.renderedChars,
			isStreaming: true,
			lastFrameTime: null,
		};
	}

	const elapsedMs =
		progress.lastFrameTime === null
			? DEFAULT_FRAME_DURATION_MS
			: Math.max(frameTime - progress.lastFrameTime, 1);
	const gap = progress.totalChars - progress.revealedChars;
	const charsPerFrame = calculateCharsPerFrame(gap, elapsedMs);
	const revealedChars = Math.min(progress.revealedChars + charsPerFrame, progress.totalChars);

	return {
		totalChars: progress.totalChars,
		revealedChars,
		renderedChars: progress.renderedChars,
		isStreaming: true,
		lastFrameTime: frameTime,
	};
}

export function commitRenderedReveal(progress: RevealProgress): RevealProgress {
	return {
		totalChars: progress.totalChars,
		revealedChars: progress.revealedChars,
		renderedChars: progress.revealedChars,
		isStreaming: progress.isStreaming,
		lastFrameTime: progress.lastFrameTime,
	};
}
