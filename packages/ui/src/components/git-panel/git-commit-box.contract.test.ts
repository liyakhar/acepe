import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "bun:test";

const source = readFileSync(resolve(import.meta.dir, "./git-commit-box.svelte"), "utf8");

describe("git commit box contract", () => {
	it("delegates to the dedicated git commit composer instead of the kanban composer", () => {
		expect(source).toContain('import GitCommitComposer from "./git-commit-composer.svelte";');
		expect(source).toContain("<GitCommitComposer");
		expect(source).not.toContain("KanbanCompactComposer");
	});
});
