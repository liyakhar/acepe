import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "bun:test";

const agentInputDir = import.meta.dir;

function read(relativePath: string): string {
	return readFileSync(resolve(agentInputDir, relativePath), "utf8");
}

describe("agent input floating layers contract", () => {
	it("anchors custom portaled dropdowns to the shared overlay z-index token", () => {
		const slashDropdownSource = read("../slash-command-dropdown/slash-command-dropdown-ui.svelte");
		const filePickerSource = read("../file-picker/file-picker-dropdown.svelte");

		expect(slashDropdownSource).toContain("z-[var(--overlay-z)]");
		expect(filePickerSource).toContain("z-[var(--overlay-z)]");
		expect(slashDropdownSource).not.toContain("z-[100]");
		expect(filePickerSource).not.toContain("z-[100]");
	});

	it("does not override shared dropdown layering with local z-index classes", () => {
		const sessionListSource = read("../session-list/session-list-ui.svelte");
		const branchPickerSource = read("../worktree-toggle/branch-picker.svelte");

		expect(sessionListSource).not.toContain('class="z-50');
		expect(sessionListSource).not.toContain('class="z-[60]');
		expect(branchPickerSource).not.toContain('class="z-[60]');
	});
});