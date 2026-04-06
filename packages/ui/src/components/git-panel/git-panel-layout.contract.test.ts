import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "bun:test";

const source = readFileSync(resolve(import.meta.dir, "./git-panel-layout.svelte"), "utf8");

describe("git panel layout contract", () => {
	it("keeps the commit input focusable when there are no staged files", () => {
		expect(source).toContain("submitDisabled={stagedFiles.length === 0}");
		expect(source).not.toContain("disabled={stagedFiles.length === 0}");
	});
});
