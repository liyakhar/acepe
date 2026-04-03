import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readComponent(relativePath: string): string {
	return readFileSync(resolve(import.meta.dir, "..", relativePath), "utf8");
}

describe("shared chip adoption contract", () => {
	it("uses ChipShell in file, github, and inline artefact badges", () => {
		const fileBadge = readComponent("file-path-badge/file-path-badge.svelte");
		const githubBadge = readComponent("github-badge/github-badge.svelte");
		const inlineArtefactBadge = readComponent("inline-artefact-badge/inline-artefact-badge.svelte");

		expect(fileBadge).toContain("ChipShell");
		expect(githubBadge).toContain("ChipShell");
		expect(inlineArtefactBadge).toContain("ChipShell");
	});
});