import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "../agent-store.svelte.ts"), "utf8");

describe("agent store default-selection contract", () => {
	it("derives default selection from backend metadata instead of hardcoded provider ids", () => {
		expect(source).toContain("default_selection_rank");
		expect(source).not.toContain("const priorityOrder");
		expect(source).not.toContain('"claude-code"');
		expect(source).not.toContain('"cursor"');
		expect(source).not.toContain('"codex"');
		expect(source).not.toContain('"opencode"');
	});
});
