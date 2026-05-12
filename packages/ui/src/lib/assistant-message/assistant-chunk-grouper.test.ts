import { describe, expect, it } from "bun:test";

import { groupAssistantChunks } from "./assistant-chunk-grouper.js";

describe("groupAssistantChunks", () => {
	it("keeps malformed text blocks out of text groups", () => {
		const chunks: Parameters<typeof groupAssistantChunks>[0] = [
			{ type: "message", block: { type: "text" } },
		];

		const grouped = groupAssistantChunks(chunks);

		expect(grouped.messageGroups).toEqual([{ type: "other", block: { type: "text" } }]);
	});
});
