export function resolveThinkingDurationMs(input: {
	startedAtMs?: number | null;
	durationMs?: number | null;
	nowMs: number;
}): number | null {
	if (input.startedAtMs !== null && input.startedAtMs !== undefined) {
		return Math.max(0, input.nowMs - input.startedAtMs);
	}

	return input.durationMs ?? null;
}

export function shouldRunThinkingTimer(startedAtMs?: number | null): boolean {
	return startedAtMs !== null && startedAtMs !== undefined;
}
