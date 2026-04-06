import { describe, expect, it } from "bun:test";

import { splitStreamingSections } from "../split-streaming-sections.js";

describe("splitStreamingSections", () => {
	it("creates stable section keys from top-level tag name and index", () => {
		expect(splitStreamingSections("<h2>Title</h2><p>Body</p>")).toEqual([
			{ key: "H2:0", html: "<h2>Title</h2>", tagName: "H2" },
			{ key: "P:1", html: "<p>Body</p>", tagName: "P" },
		]);
	});

	it("ignores whitespace-only top-level text nodes", () => {
		expect(splitStreamingSections("\n  <p>Body</p>\n")).toEqual([
			{ key: "P:0", html: "<p>Body</p>", tagName: "P" },
		]);
	});
});
