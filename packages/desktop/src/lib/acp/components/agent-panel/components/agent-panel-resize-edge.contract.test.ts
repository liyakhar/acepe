import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "./agent-panel-resize-edge.svelte"), "utf8");

describe("agent panel resize edge contract", () => {
	it("keeps the resize hit area between the header and footer chrome", () => {
		expect(source).toContain("absolute top-7 bottom-7 right-0 z-10 flex w-3 cursor-col-resize");
		expect(source).not.toContain("absolute top-0 right-0 z-10 flex h-full w-3");
	});
});
