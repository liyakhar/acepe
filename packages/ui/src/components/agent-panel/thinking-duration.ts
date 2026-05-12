export function resolveThinkingDurationMs(input: {
	startedAtMs?: number | null;
	durationMs?: number | null;
	nowMs: number;
}): number | null {
	if (input.startedAtMs !== null && input.startedAtMs !== undefined) {
		return Math.max(0, input.nowMs - input.startedAtMs);
	}

	if (input.durationMs !== null && input.durationMs !== undefined) {
		return input.durationMs;
	}

	return null;
}

export function shouldRunThinkingTimer(startedAtMs?: number | null): boolean {
	return startedAtMs !== null && startedAtMs !== undefined;
}
