import type { AgentPanelSceneEntryModel } from "@acepe/ui/agent-panel";
import type { SessionEntry } from "../../../application/dto/session-entry.js";

function buildTimestampByEntryId(
	sessionEntries: readonly SessionEntry[]
): ReadonlyMap<string, number> {
	const timestampByEntryId = new Map<string, number>();

	for (const entry of sessionEntries) {
		const timestampMs = entry.timestamp?.getTime();
		if (timestampMs === undefined) continue;
		timestampByEntryId.set(entry.id, timestampMs);
	}

	return timestampByEntryId;
}

export function backfillSceneEntryTimestamps(
	sceneEntries: readonly AgentPanelSceneEntryModel[],
	sessionEntries: readonly SessionEntry[]
): readonly AgentPanelSceneEntryModel[] {
	const timestampByEntryId = buildTimestampByEntryId(sessionEntries);

	return sceneEntries.map((entry) => {
		if ((entry.type !== "user" && entry.type !== "assistant") || entry.timestampMs !== undefined) {
			return entry;
		}

		const timestampMs = timestampByEntryId.get(entry.id);
		if (timestampMs === undefined) {
			return entry;
		}

		if (entry.type === "user") {
			return {
				id: entry.id,
				type: entry.type,
				text: entry.text,
				isOptimistic: entry.isOptimistic,
				timestampMs,
			};
		}

		return {
			id: entry.id,
			type: entry.type,
			markdown: entry.markdown,
			message: entry.message,
			isStreaming: entry.isStreaming,
			tokenRevealCss: entry.tokenRevealCss,
			timestampMs,
		};
	});
}
