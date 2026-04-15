import type { SessionEntry } from "../../../application/dto/session.js";
import type { ErrorMessage } from "../../../types/error-message.js";

interface ResolveVisibleSessionEntriesInput {
	readonly sessionEntries: readonly SessionEntry[];
	readonly showInlineErrorCard: boolean;
	readonly activeTurnError: ErrorMessage | null;
}

export function resolveVisibleSessionEntries(
	input: ResolveVisibleSessionEntriesInput
): readonly SessionEntry[] {
	if (!input.showInlineErrorCard || input.activeTurnError === null) {
		return input.sessionEntries;
	}

	const lastEntry = input.sessionEntries.at(-1);
	if (!lastEntry || lastEntry.type !== "error") {
		return input.sessionEntries;
	}

	if (lastEntry.message !== input.activeTurnError) {
		return input.sessionEntries;
	}

	return input.sessionEntries.slice(0, -1);
}
