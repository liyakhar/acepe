export type ViewportFallbackReason = "zero_viewport" | "no_rendered_entries";

export type IndexedViewportEntry<T> = {
	entry: T;
	index: number;
};

export function buildNativeFallbackWindow<T>(
	entries: readonly T[],
	limit: number
): readonly IndexedViewportEntry<T>[] {
	const startIndex = Math.max(0, entries.length - limit);
	const result: IndexedViewportEntry<T>[] = [];
	for (let index = startIndex; index < entries.length; index += 1) {
		const entry = entries[index];
		if (!entry) {
			continue;
		}
		result.push({ entry, index });
	}
	return result;
}

export function shouldRetryNativeFallback(input: {
	reason: ViewportFallbackReason | null;
	retryCount: number;
}): boolean {
	return input.reason === "no_rendered_entries" && input.retryCount === 0;
}
