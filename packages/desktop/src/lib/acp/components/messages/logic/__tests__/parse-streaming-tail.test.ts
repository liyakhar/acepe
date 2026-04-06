import { describe, expect, it } from "bun:test";

import { parseStreamingTail } from "../parse-streaming-tail.js";

describe("parseStreamingTail", () => {
	it("keeps the trailing paragraph live while earlier blocks are settled", () => {
		expect(parseStreamingTail("# Title\n\nHello")).toEqual({
			sections: [
				{ key: "SETTLED:0", kind: "settled", markdown: "# Title" },
				{ key: "LIVE:1", kind: "live-text", text: "Hello" },
			],
		});
	});

	it("keeps an open fenced code block live without the fence markers", () => {
		expect(parseStreamingTail("```ts\nconst a = 1;\nconst b = 2;")).toEqual({
			sections: [
				{
					key: "LIVE:0",
					kind: "live-code",
					code: "const a = 1;\nconst b = 2;",
					language: "ts",
				},
			],
		});
	});

	it("settles a fenced code block once the closing fence arrives", () => {
		expect(parseStreamingTail("```ts\nconst a = 1;\n```")).toEqual({
			sections: [
				{
					key: "SETTLED:0",
					kind: "settled",
					markdown: "```ts\nconst a = 1;\n```",
				},
			],
		});
	});
});
