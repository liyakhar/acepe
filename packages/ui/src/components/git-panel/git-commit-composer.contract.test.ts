import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "bun:test";

const source = readFileSync(resolve(import.meta.dir, "./git-commit-composer.svelte"), "utf8");

describe("git commit composer contract", () => {
	it("uses the agent input container pattern for the commit composer surface", () => {
		expect(source).toContain('import { InputContainer } from "../input-container/index.js";');
		expect(source).toContain('<InputContainer class="flex-shrink-0 border border-border" contentClass="p-2">');
		expect(source).toContain('class="min-h-[72px]');
		expect(source).toContain('class="h-7 w-7 cursor-pointer shrink-0 rounded-full bg-foreground text-background');
		expect(source).toContain("submitDisabled?: boolean;");
		expect(source).toContain("disabled={!canCommit || submitDisabled}");
	});
});
