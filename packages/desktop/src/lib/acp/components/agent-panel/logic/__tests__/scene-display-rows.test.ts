import type { AgentPanelSceneEntryModel } from "@acepe/ui/agent-panel";
import { describe, expect, it } from "bun:test";
import {
	buildSceneDisplayRows,
	getSceneDisplayRowKey,
	getSceneDisplayRowTimestampMs,
	resolveSceneDisplayRowThinkingDurationMs,
	THINKING_DISPLAY_ENTRY,
} from "../scene-display-rows.js";

describe("scene-display-rows", () => {
	it("builds stable scene-derived display rows for mixed conversation entries", () => {
		const rows = buildSceneDisplayRows([
			{ id: "user-1", type: "user", text: "Prompt" },
			{ id: "assistant-1", type: "assistant", markdown: "First" },
			{ id: "assistant-2", type: "assistant", markdown: "Second" },
			{ id: "tool-1", type: "tool_call", title: "Run", status: "done" },
			{ id: "missing-1", type: "missing", diagnosticLabel: "missing-1" },
		]);

		expect(rows.map((row) => getSceneDisplayRowKey(row))).toEqual([
			"user-1",
			"assistant-1",
			"tool-1",
			"missing-1",
		]);
		expect(rows[1]?.type).toBe("assistant_merged");
		if (rows[1]?.type === "assistant_merged") {
			expect(rows[1].memberIds).toEqual(["assistant-1", "assistant-2"]);
		}
	});

	it("keeps destructive scene row replacements visible in ordered display keys", () => {
		const initial: AgentPanelSceneEntryModel[] = [
			{ id: "user-1", type: "user", text: "Prompt" },
			{ id: "assistant-1", type: "assistant", markdown: "First" },
			{ id: "user-2", type: "user", text: "Next" },
		];
		const replacement: AgentPanelSceneEntryModel[] = [
			{ id: "user-1", type: "user", text: "Prompt" },
			{ id: "user-2", type: "user", text: "Next" },
			{ id: "assistant-2", type: "assistant", markdown: "Replacement" },
		];

		const initialKeys = buildSceneDisplayRows(initial).map((row) => getSceneDisplayRowKey(row));
		const replacementKeys = buildSceneDisplayRows(replacement).map((row) =>
			getSceneDisplayRowKey(row)
		);

		expect(initialKeys).toEqual(["user-1", "assistant-1", "user-2"]);
		expect(replacementKeys).toEqual(["user-1", "user-2", "assistant-2"]);
		expect(replacementKeys.slice(0, initialKeys.length)).not.toEqual(initialKeys);
	});

	it("derives thinking durations from scene timestamps", () => {
		const startedAtMs = Date.parse("2026-05-01T00:00:00.000Z");
		const rows = buildSceneDisplayRows([
			{
				id: "assistant-1",
				type: "assistant",
				markdown: "Thinking result",
				timestampMs: startedAtMs,
			},
		]);
		const displayRows = rows.concat([
			{
				id: THINKING_DISPLAY_ENTRY.id,
				type: THINKING_DISPLAY_ENTRY.type,
				startedAtMs,
			},
		]);

		expect(getSceneDisplayRowTimestampMs(rows[0]!)).toBe(startedAtMs);
		expect(resolveSceneDisplayRowThinkingDurationMs(displayRows, 1, startedAtMs + 3_000)).toBe(
			3_000
		);
	});

	it("preserves rich assistant thought chunks for completed scene durations", () => {
		const startedAtMs = Date.parse("2026-05-01T00:00:00.000Z");
		const nextTimestampMs = startedAtMs + 5_000;
		const rows = buildSceneDisplayRows([
			{
				id: "assistant-1",
				type: "assistant",
				markdown: "Thinking result",
				timestampMs: startedAtMs,
				message: {
					chunks: [{ type: "thought", block: { type: "text", text: "Checking" } }],
				},
			},
			{ id: "user-2", type: "user", text: "Next", timestampMs: nextTimestampMs },
		]);

		expect(resolveSceneDisplayRowThinkingDurationMs(rows, 0, startedAtMs + 30_000)).toBe(5_000);
	});
});
