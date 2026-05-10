import type { AgentPanelSceneEntryModel } from "@acepe/ui/agent-panel";
import { describe, expect, it } from "bun:test";
import type { SessionEntry } from "../../../../application/dto/session-entry.js";
import { backfillSceneEntryTimestamps } from "../backfill-scene-entry-timestamps.js";

function createUserSessionEntry(id: string, timestamp: string): SessionEntry {
	return {
		id,
		type: "user",
		message: {
			content: { type: "text", text: id },
			chunks: [{ type: "text", text: id }],
			sentAt: new Date(timestamp),
		},
		timestamp: new Date(timestamp),
	};
}

function createAssistantSessionEntry(id: string, timestamp: string): SessionEntry {
	return {
		id,
		type: "assistant",
		message: {
			chunks: [{ type: "message", block: { type: "text", text: id } }],
			receivedAt: new Date(timestamp),
		},
		timestamp: new Date(timestamp),
	};
}

describe("backfillSceneEntryTimestamps", () => {
	it("fills missing user and assistant timestamps from session entries", () => {
		const sceneEntries: AgentPanelSceneEntryModel[] = [
			{ id: "user-1", type: "user", text: "Prompt" },
			{ id: "assistant-1", type: "assistant", markdown: "Reply" },
		];

		const result = backfillSceneEntryTimestamps(sceneEntries, [
			createUserSessionEntry("user-1", "2026-05-07T10:00:00.000Z"),
			createAssistantSessionEntry("assistant-1", "2026-05-07T10:00:05.000Z"),
		]);

		expect(result).toEqual([
			{
				id: "user-1",
				type: "user",
				text: "Prompt",
				isOptimistic: undefined,
				timestampMs: Date.parse("2026-05-07T10:00:00.000Z"),
			},
			{
				id: "assistant-1",
				type: "assistant",
				markdown: "Reply",
				message: undefined,
				isStreaming: undefined,
				timestampMs: Date.parse("2026-05-07T10:00:05.000Z"),
			},
		]);
	});

	it("preserves scene entries that already have timestamps", () => {
		const existingTimestampMs = Date.parse("2026-05-07T11:00:00.000Z");
		const sceneEntries: AgentPanelSceneEntryModel[] = [
			{ id: "user-1", type: "user", text: "Prompt", timestampMs: existingTimestampMs },
		];

		const result = backfillSceneEntryTimestamps(sceneEntries, [
			createUserSessionEntry("user-1", "2026-05-07T12:00:00.000Z"),
		]);

		expect(result[0]).toBe(sceneEntries[0]);
	});
});
